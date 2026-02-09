// === Customer List (single default list - auto-created) ===

export interface CustomerList {
  id: string;          // uuid
  name: string;
  description?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  item_count: number;
}

// === Customer record in database ===

export interface CustomerListItem {
  id?: number;         // bigint auto-generated
  list_id: string;
  customer_ext_id: string;   // maps to Customer.id
  name: string;
  phone: string;
  created_at?: string;
  updated_at?: string;
}

// Insert payload (omit auto-generated fields)
export type CustomerListItemInsert = Omit<CustomerListItem, 'id' | 'list_id' | 'created_at' | 'updated_at'>;
