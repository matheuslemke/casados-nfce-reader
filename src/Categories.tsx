import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { MonthNavigation } from "./MonthNavigation";
import { toast } from "sonner";
import { useState } from "react";
import { Id } from "../convex/_generated/dataModel";

interface Invoice {
  _id: Id<"nfce_links">;
  emission_ts?: number;
  override_month?: number;
  override_year?: number;
  total_amount?: number;
  total_amount_str?: string;
  discount?: number;
  issuer?: string;
  status: string;
  categoryId?: Id<"categories">;
}

function effectiveMonthYear(inv: Invoice): { month: number | null; year: number | null } {
  if (inv.override_month !== undefined && inv.override_year !== undefined) {
    return { month: inv.override_month, year: inv.override_year };
  }
  if (!inv.emission_ts) return { month: null, year: null };
  const d = new Date(inv.emission_ts);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export function Categories() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const categories = useQuery(api.categories.listCategories) ?? [];
  const invoices = (useQuery(api.nfce.listInvoices) ?? []) as Invoice[];
  const createCategory = useMutation(api.categories.createCategory);
  const setDefault = useMutation(api.categories.setDefault);
  const deleteCategory = useMutation(api.categories.deleteCategory);

  const monthInvoices = invoices.filter((inv) => {
    const { month, year } = effectiveMonthYear(inv);
    if (month === null || year === null) return false;
    return month === selectedMonth && year === selectedYear;
  });

  const monthTotal = monthInvoices.reduce((sum, inv) => {
    const amount = typeof inv.total_amount === "number" ? inv.total_amount : 0;
    const disc = typeof inv.discount === "number" ? inv.discount : 0;
    return sum + amount - disc;
  }, 0);

  const monthLabel = new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await createCategory({ name });
      setNewCategoryName("");
      setShowAddForm(false);
      toast.success(`Categoria "${name}" criada`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar categoria");
    }
  };

  const handleSetDefault = async (id: Id<"categories">) => {
    try {
      await setDefault({ id });
      toast.success("Categoria padrão atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao definir padrão");
    }
  };

  const handleDelete = async (id: Id<"categories">) => {
    try {
      await deleteCategory({ id });
      toast.success("Categoria excluída");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir categoria");
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Categorias</h1>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            + Nova Categoria
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={(e) => void handleCreateCategory(e)} className="mt-4 flex gap-2">
            <input
              autoFocus
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nome da categoria"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewCategoryName(""); }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
          </form>
        )}
      </div>

      <MonthNavigation
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        onMonthChange={(month, year) => { setSelectedMonth(month); setSelectedYear(year); }}
      />

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="mb-4 text-sm font-medium">
          Total para {monthLabel}: <span className="text-blue-700">{fmt(monthTotal)}</span>
        </div>

        {categories.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Nenhuma categoria ainda. Crie uma acima!
          </p>
        ) : (
          <div className="space-y-6">
            {categories.map((cat) => {
              const catInvoices = monthInvoices.filter((inv) => inv.categoryId === cat._id);
              const catTotal = catInvoices.reduce((sum, inv) => {
                const amount = typeof inv.total_amount === "number" ? inv.total_amount : 0;
                const disc = typeof inv.discount === "number" ? inv.discount : 0;
                return sum + amount - disc;
              }, 0);

              return (
                <div key={cat._id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{cat.name}</h3>
                      {cat.isDefault && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                          padrão
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!cat.isDefault && (
                        <button
                          onClick={() => void handleSetDefault(cat._id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Definir como padrão
                        </button>
                      )}
                      <button
                        onClick={() => void handleDelete(cat._id)}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 mb-3">
                    Total: <span className="font-medium text-gray-800">{fmt(catTotal)}</span>
                    {" "}·{" "}
                    {catInvoices.length} nota{catInvoices.length !== 1 ? "s" : ""}
                  </div>

                  {catInvoices.length > 0 ? (
                    <div className="space-y-2">
                      {catInvoices.map((inv) => (
                        <div
                          key={inv._id}
                          className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500">
                              {typeof inv.emission_ts === "number"
                                ? new Date(inv.emission_ts).toLocaleDateString("pt-BR")
                                : "Sem data"}
                            </span>
                            <span className="text-gray-800">{inv.issuer ?? "-"}</span>
                          </div>
                          <span className="font-medium text-gray-800">
                            {typeof inv.total_amount === "number"
                              ? fmt(inv.total_amount - (inv.discount ?? 0))
                              : "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Nenhuma nota neste mês.</p>
                  )}
                </div>
              );
            })}

            {/* Uncategorized invoices */}
            {(() => {
              const uncategorized = monthInvoices.filter((inv) => !inv.categoryId);
              if (uncategorized.length === 0) return null;
              const total = uncategorized.reduce((sum, inv) => {
                const amount = typeof inv.total_amount === "number" ? inv.total_amount : 0;
                const disc = typeof inv.discount === "number" ? inv.discount : 0;
                return sum + amount - disc;
              }, 0);
              return (
                <div className="border border-dashed rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-lg font-semibold text-gray-500">Sem categoria</h3>
                  </div>
                  <div className="text-sm text-gray-600 mb-3">
                    Total: <span className="font-medium text-gray-800">{fmt(total)}</span>
                    {" "}·{" "}
                    {uncategorized.length} nota{uncategorized.length !== 1 ? "s" : ""}
                  </div>
                  <div className="space-y-2">
                    {uncategorized.map((inv) => (
                      <div
                        key={inv._id}
                        className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500">
                            {typeof inv.emission_ts === "number"
                              ? new Date(inv.emission_ts).toLocaleDateString("pt-BR")
                              : "Sem data"}
                          </span>
                          <span className="text-gray-800">{inv.issuer ?? "-"}</span>
                        </div>
                        <span className="font-medium text-gray-800">
                          {typeof inv.total_amount === "number"
                            ? fmt(inv.total_amount - (inv.discount ?? 0))
                            : "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
