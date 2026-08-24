import { TaxSettings } from '@/components/tax-settings/tax-settings';

export default function TaxSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tax Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure VAT, WHT, and VAT Withholding rates, and which clients they apply to.
        </p>
      </div>
      <TaxSettings />
    </div>
  );
}
