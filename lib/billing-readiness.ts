export type CommercialBillingRuntimeState = Readonly<{
  providerSelected: boolean;
  checkoutImplemented: boolean;
  lifecycleSyncImplemented: boolean;
  customerSelfServiceImplemented: boolean;
  commercialReady: boolean;
}>;

// C3 deliberately builds entitlements before choosing a commercial provider.
// A future provider integration must replace these implementation flags only
// after checkout, lifecycle/webhook sync and customer self-service are real.
export const commercialBillingRuntime: CommercialBillingRuntimeState = {
  providerSelected: false,
  checkoutImplemented: false,
  lifecycleSyncImplemented: false,
  customerSelfServiceImplemented: false,
  commercialReady: false,
};
