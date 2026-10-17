export type InventoryDecision={accepted:boolean;reason:string;permitsRuntime:false};
export declare function validateReadOnlyWindowsInventory(value:unknown):boolean;
export declare function evaluateReadOnlyInventory(value:unknown, environment?:Record<string,string|undefined>):InventoryDecision;
