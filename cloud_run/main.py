"""
Cloud Run function để xử lý đơn hàng từ Supabase và gọi API Nhanh.vn
Chạy mỗi phút thông qua Cloud Scheduler
"""
import os
import json
from flask import Flask, request, jsonify
from supabase import create_client, Client
import requests
from datetime import datetime
from typing import Dict, Any, List

# Environment variables
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
APP_ID = os.environ.get('APP_ID')
BUSINESS_ID = os.environ.get('BUSINESS_ID')
ACCESS_TOKEN = os.environ.get('ACCESS_TOKEN')
API_BASE_URL = 'https://pos.open.nhanh.vn/v3.0'
PROCESS_LIMIT = int(os.environ.get('PROCESS_LIMIT', '10'))  # Số đơn xử lý mỗi lần (mặc định 10)


# Tạo Flask app
app = Flask(__name__)

@app.route('/process_order', methods=['GET', 'POST'])
def process_order():
    """
    Cloud Run function được gọi bởi Cloud Scheduler mỗi phút
    
    Flow:
    1. Lấy các đơn hàng pending đã đến giờ từ Supabase
    2. Với mỗi đơn hàng:
       - Cập nhật status thành 'processing'
       - Gọi API Nhanh.vn để tạo đơn hàng
       - Lưu kết quả vào order_results
       - Cập nhật status: 'completed' hoặc 'failed'
    """
    
    # Validate environment variables
    if not all([SUPABASE_URL, SUPABASE_KEY, APP_ID, BUSINESS_ID, ACCESS_TOKEN]):
        return jsonify({
            'error': 'Missing required environment variables',
            'status': 'error'
        }), 500
    
    try:
        # Kết nối Supabase
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Lấy các đơn hàng pending đã đến giờ
        now = datetime.utcnow().isoformat()
        response = supabase.table('orders_queue')\
            .select('*')\
            .eq('status', 'pending')\
            .lte('scheduled_time', now)\
            .order('order_index', desc=False)\
            .limit(PROCESS_LIMIT)\
            .execute()
        
        orders = response.data if hasattr(response, 'data') else []
        
        if not orders:
            return jsonify({
                'message': 'No orders to process',
                'status': 'ok',
                'processed': 0
            }), 200
        
        results: List[Dict[str, Any]] = []
        
        for order in orders:
            order_id = order['id']
            order_data = order.get('order_data', {})
            order_index = order.get('order_index', 0)
            
            try:
                # Cập nhật status thành processing
                supabase.table('orders_queue')\
                    .update({'status': 'processing'})\
                    .eq('id', order_id)\
                    .execute()
                
                # Gọi API Nhanh.vn
                url = f"{API_BASE_URL}/bill/addretail?appId={APP_ID}&businessId={BUSINESS_ID}"
                headers = {
                    'Authorization': ACCESS_TOKEN,
                    'Content-Type': 'application/json'
                }
                
                # Đảm bảo order_data có payment
                if not isinstance(order_data, dict):
                    order_data = json.loads(order_data) if isinstance(order_data, str) else {}
                
                # Log để debug - xem payload thực tế được gửi
                print(f"Order {order_id}: Full order_data being sent:")
                print(json.dumps(order_data, indent=2, ensure_ascii=False))
                print(f"Order {order_id}: Payment field: {order_data.get('payment')}")
                
                response = requests.post(url, json=order_data, headers=headers, timeout=30)
                response_data = response.json()
                
                # Log response để debug
                print(f"Order {order_id}: API Response:")
                print(json.dumps(response_data, indent=2, ensure_ascii=False))
                
                # Xử lý kết quả
                success = response_data.get('code') == 1
                bill_id = None
                total_amount = None
                error_message = None
                
                if success:
                    data = response_data.get('data', {})
                    bill_id = data.get('id')
                    # Chỉ cập nhật total_amount nếu API trả về và > 0
                    # Nếu không, giữ nguyên total_amount ban đầu
                    api_total_amount = data.get('totalAmount')
                    if api_total_amount and api_total_amount > 0:
                        total_amount = api_total_amount
                else:
                    messages = response_data.get('messages', [])
                    error_message = ', '.join(messages) if isinstance(messages, list) else str(messages)
                
                # Lưu kết quả vào order_results
                supabase.table('order_results').insert({
                    'order_queue_id': order_id,
                    'order_index': order_index,
                    'bill_id': bill_id,
                    'api_response': response_data,
                    'success': success,
                    'error_message': error_message
                }).execute()
                
                # Cập nhật status trong orders_queue (bao gồm bill_id và total_amount nếu có)
                status = 'completed' if success else 'failed'
                update_data = {
                    'status': status,
                    'processed_at': datetime.utcnow().isoformat(),
                }
                
                # Lưu bill_id vào orders_queue để dễ query
                if bill_id:
                    update_data['bill_id'] = bill_id
                
                # Chỉ cập nhật total_amount nếu API trả về giá trị hợp lệ (> 0)
                # Nếu không, giữ nguyên total_amount ban đầu (không cập nhật)
                if total_amount is not None and total_amount > 0:
                    update_data['total_amount'] = total_amount
                # Nếu total_amount = 0 hoặc None, không cập nhật (giữ nguyên giá trị ban đầu)
                
                if error_message:
                    update_data['error_message'] = error_message
                
                supabase.table('orders_queue')\
                    .update(update_data)\
                    .eq('id', order_id)\
                    .execute()
                
                results.append({
                    'order_id': order_id,
                    'order_index': order_index,
                    'status': status,
                    'bill_id': bill_id,
                    'success': success
                })
                
            except requests.exceptions.RequestException as e:
                # Lỗi network/API
                error_message = f"Network error: {str(e)}"
                
                supabase.table('orders_queue')\
                    .update({
                        'status': 'failed',
                        'processed_at': datetime.utcnow().isoformat(),
                        'error_message': error_message
                    })\
                    .eq('id', order_id)\
                    .execute()
                
                supabase.table('order_results').insert({
                    'order_queue_id': order_id,
                    'order_index': order_index,
                    'api_response': {},
                    'success': False,
                    'error_message': error_message
                }).execute()
                
                results.append({
                    'order_id': order_id,
                    'order_index': order_index,
                    'status': 'failed',
                    'error': error_message,
                    'success': False
                })
                
            except Exception as e:
                # Lỗi khác
                error_message = f"Unexpected error: {str(e)}"
                
                supabase.table('orders_queue')\
                    .update({
                        'status': 'failed',
                        'processed_at': datetime.utcnow().isoformat(),
                        'error_message': error_message
                    })\
                    .eq('id', order_id)\
                    .execute()
                
                supabase.table('order_results').insert({
                    'order_queue_id': order_id,
                    'order_index': order_index,
                    'api_response': {},
                    'success': False,
                    'error_message': error_message
                }).execute()
                
                results.append({
                    'order_id': order_id,
                    'order_index': order_index,
                    'status': 'failed',
                    'error': error_message,
                    'success': False
                })
        
        # Thống kê kết quả
        success_count = sum(1 for r in results if r.get('success', False))
        failed_count = len(results) - success_count
        
        return jsonify({
            'message': f'Processed {len(results)} orders',
            'status': 'ok',
            'processed': len(results),
            'success': success_count,
            'failed': failed_count,
            'results': results
        }), 200
        
    except Exception as e:
        return jsonify({
            'error': f'Function error: {str(e)}',
            'status': 'error'
        }), 500