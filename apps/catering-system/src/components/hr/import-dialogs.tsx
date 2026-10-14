'use client';

import { CsvImportDialog } from '@/components/hr/csv-import-dialog';
import {
  CONTRACT_COLUMNS, CONTRACT_TEMPLATE_CSV, OPENING_COLUMNS, checkContractRows, checkOpeningRows, openingTemplateCsv,
} from '@/lib/hr-import';
import {
  getGoLiveYear, importLegacyContracts, importOpeningLeave, loadContractCheckContext, loadOpeningCheckContext,
} from '@/services/hrImportService';

interface Props { isOpen: boolean; setIsOpen: (o: boolean) => void; onImported?: () => void }

/** Employees page: contracts signed before the system (see the HR guide). */
export function ImportContractsDialog(props: Props) {
  return (
    <CsvImportDialog
      {...props}
      title="Import existing contracts"
      description="Record the contracts staff already have on paper, so the contract history and the expiry reminders include them. No letters are produced."
      columns={CONTRACT_COLUMNS}
      templateCsv={() => CONTRACT_TEMPLATE_CSV}
      templateName="existing-contracts-template.csv"
      prepare={async () => {
        const ctx = await loadContractCheckContext();
        return (rows) => checkContractRows(rows, ctx);
      }}
      importRows={async (rows) => {
        const r = await importLegacyContracts(rows);
        return `${r.imported} contract(s) imported: ${r.active} current, ${r.expired} past.`;
      }}
    />
  );
}

/** Leave page: leave already taken this year before the system was used. */
export function ImportOpeningBalancesDialog(props: Props) {
  return (
    <CsvImportDialog
      {...props}
      title="Import opening balances"
      description="Enter the leave each person already took this year before go-live. It is kept apart from leave taken through the system, and reduces what is left. Only for the go-live year."
      columns={OPENING_COLUMNS}
      templateCsv={async () => openingTemplateCsv(await getGoLiveYear())}
      templateName="opening-leave-balances-template.csv"
      prepare={async () => {
        const ctx = await loadOpeningCheckContext();
        return (rows) => checkOpeningRows(rows, ctx);
      }}
      importRows={async (rows) => {
        const r = await importOpeningLeave(rows);
        return `${r.imported} opening balance(s) imported.`;
      }}
    />
  );
}
