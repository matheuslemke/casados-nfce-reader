import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";
import { useState } from "react";
import { Id } from "../convex/_generated/dataModel";
import { InvoiceItemsTable } from "./InvoiceItemsTable";
import { MonthNavigation } from "./MonthNavigation";

interface IssuerSummary {
  issuer: string;
  count: number;
}

interface UnitSummary {
  unit: string;
  count: number;
}

interface TokenSummary {
  token: string;
  count: number;
}

interface UnclassifiedSummary {
  count: number;
  byIssuer: IssuerSummary[];
  commonUnits: UnitSummary[];
  commonTokens: TokenSummary[];
}

interface CanonicalProduct {
  _id: Id<"canonicalProducts">;
  baseName: string;
  unit: string;
  unitDetail?: string;
}

interface StoreComparison {
  issuer: string;
  value: number;
  sampleSize: number;
}

export function Management() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedProductForCompare, setSelectedProductForCompare] = useState("");
  const [selectedUnitForCompare, setSelectedUnitForCompare] = useState("");

  const handleMonthChange = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  // Classification & rule management
  const syncItems = useMutation(api.classify.syncInvoiceItemsFromInvoices);
  const classifyBatch = useMutation(api.classify.classifyItems);
  const unclassifiedSummary: UnclassifiedSummary = useQuery(api.classify.getUnclassifiedSummary, {
    month: selectedMonth,
    year: selectedYear,
  }) || {
    count: 0,
    byIssuer: [],
    commonUnits: [],
    commonTokens: [],
  };
  const products: CanonicalProduct[] = useQuery(api.catalog.listCanonicalProducts) || [];
  const storeCompare: StoreComparison[] | undefined = useQuery(
    api.pricing.compareStorePrices,
    selectedProductForCompare && selectedUnitForCompare
      ? {
          canonicalProductId:
            selectedProductForCompare as unknown as Id<"canonicalProducts">,
          unit: selectedUnitForCompare,
        }
      : "skip"
  );

  const handleSyncItems = async () => {
    try {
      const result = await syncItems({ reprocessAll: false });
      toast.success(`Sincronizado: ${result.inserted} inseridos, ${result.deleted} excluídos`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar itens");
    }
  };

  const handleClassifyBatch = async () => {
    try {
      const result = await classifyBatch({ batchSize: 200 });
      toast.success(`Classificados: ${result.classified}/${result.processed} itens`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Falha ao classificar lote");
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-3xl font-bold mb-6">Gerenciamento de Classificação e Preços</h1>
        
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => {
              void handleSyncItems();
            }}
            className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900 transition-colors"
          >
            Sincronizar Itens
          </button>
          <button
            onClick={() => {
              void handleClassifyBatch();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Classificar Lote
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Unclassified Summary */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold mb-3">Itens Não Classificados</h3>
            <div className="text-sm space-y-2">
              <div>
                <strong>Total: {unclassifiedSummary.count}</strong>
              </div>
              <div>
                <strong>Principais Emissores</strong>
                <ul className="ml-4 mt-1">
                  {unclassifiedSummary.byIssuer.slice(0, 5).map((issuer) => (
                    <li key={issuer.issuer}>
                      {issuer.issuer}: {issuer.count}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Unidades Comuns</strong>
                <ul className="ml-4 mt-1">
                  {unclassifiedSummary.commonUnits.slice(0, 5).map((unit) => (
                    <li key={unit.unit}>
                      {unit.unit}: {unit.count}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Tokens Comuns</strong>
                <ul className="ml-4 mt-1">
                  {unclassifiedSummary.commonTokens.slice(0, 10).map((token) => (
                    <li key={token.token}>
                      {token.token}: {token.count}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Store Price Comparison */}
        <div className="border rounded-lg p-4 bg-gray-50 mt-6">
          <h3 className="text-lg font-semibold mb-3">Compare Store Prices</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            <select
              className="px-3 py-2 border rounded text-sm"
              value={selectedProductForCompare}
              onChange={(e) => setSelectedProductForCompare(e.target.value)}
            >
              <option value="">Selecionar produto</option>
              {products.map((p: CanonicalProduct) => (
                <option key={p._id} value={p._id}>
                  {p.baseName} ({p.unit}
                  {p.unitDetail ? `, ${p.unitDetail}` : ""})
                </option>
              ))}
            </select>
            <input
              className="px-3 py-2 border rounded text-sm"
              placeholder="Unidade (exata, ex: KG/UNIDADE/CAIXA/PACOTE ou bruta)"
              value={selectedUnitForCompare}
              onChange={(e) => setSelectedUnitForCompare(e.target.value)}
            />
          </div>
          {storeCompare && storeCompare.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Loja</th>
                    <th className="p-2">Preço Médio</th>
                    <th className="p-2">Tamanho da Amostra</th>
                  </tr>
                </thead>
                <tbody>
                  {storeCompare.map((store: StoreComparison) => (
                    <tr key={store.issuer} className="border-t">
                      <td className="p-2">{store.issuer}</td>
                      <td className="p-2">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(store.value)}
                      </td>
                      <td className="p-2">{store.sampleSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Invoice Items Table Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Itens da Nota Fiscal</h3>
          
          {/* Month Navigation */}
          <MonthNavigation
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={handleMonthChange}
          />

          {/* Invoice Items Table */}
          <InvoiceItemsTable 
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
          />
        </div>
      </div>
    </div>
  );
}