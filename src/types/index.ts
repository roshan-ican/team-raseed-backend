export interface Filter {
    field: string;
    op: FirebaseFirestore.WhereFilterOp;
    value: any;
  }
  
  export interface AiQueryResponse {
    collection: string;
    query_type: 'find' | 'count' | 'sum' | 'average' | 'max_price_item' | 'min_price_item' | 'group_by' | 'date_range';
    field_for_sum?: 'price' | 'quantity';
    field_for_average?: 'price' | 'quantity';
    group_by_field?: 'category' | 'itemName';
    sort_by?: {
      field: string;
      direction: 'asc' | 'desc';
    };
    limit?: number;
    filters: Filter[];
  }
  
  export interface QueryResult {
    results?: any[];
    result?: any;
    error?: string;
    metadata?: {
      query_type: string;
      execution_time: number;
      document_count?: number;
    };
  }
  
  export interface ReceiptDocument {
    id?: string;
    itemName: string;
    price: number;
    quantity: number;
    categorization: string;
    purchaseDate: FirebaseFirestore.Timestamp | Date;
  }