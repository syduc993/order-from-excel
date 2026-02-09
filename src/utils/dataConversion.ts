import { Customer } from '@/types/excel';
import { CustomerListItem, CustomerListItemInsert } from '@/types/dataManagement';

/** DB item -> in-memory Customer type used by order generation */
export function customerItemToCustomer(item: CustomerListItem): Customer {
  return { id: item.customer_ext_id, name: item.name, phone: item.phone };
}

/** In-memory Customer -> DB insert payload */
export function customerToListItem(customer: Customer): CustomerListItemInsert {
  return { customer_ext_id: customer.id, name: customer.name, phone: customer.phone };
}
