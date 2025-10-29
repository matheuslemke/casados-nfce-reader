import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

type MatchType = "exact" | "contains" | "regex";

interface CanonicalProduct {
  _id: Id<"canonicalProducts">;
  baseName: string;
  unit: string;
  unitDetail?: string;
  createdAt: number;
}

interface MappingRule {
  _id: Id<"mappingRules">;
  pattern: string;
  matchType: MatchType;
  targetProductId: Id<"canonicalProducts">;
  unitSynonyms?: string[];
  active: boolean;
}

export function MappingRulesComponent() {
  // State for rule creation
  const [newRuleTarget, setNewRuleTarget] = useState("");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleMatchType, setNewRuleMatchType] = useState<MatchType>("contains");
  const [newRuleUnitSynonyms, setNewRuleUnitSynonyms] = useState("");

  // Queries and mutations
  const products = useQuery(api.catalog.listCanonicalProducts) || [];
  const rules = useQuery(api.catalog.listMappingRules, { onlyActive: false }) || [];
  const addRule = useMutation(api.catalog.addMappingRule);
  const updateRule = useMutation(api.catalog.updateMappingRule);
  const deleteRule = useMutation(api.catalog.deleteMappingRule);

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="text-lg font-semibold mb-3">Regras de Mapeamento</h3>
      <div className="space-y-2 mb-3">
        <select
          className="px-3 py-2 border rounded w-full text-sm"
          value={newRuleTarget}
          onChange={(e) => setNewRuleTarget(e.target.value)}
        >
          <option value="">Selecionar produto canônico</option>
          {products.map((p: CanonicalProduct) => (
            <option key={p._id} value={p._id}>
              {p.baseName} ({p.unit})
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 border rounded text-sm"
            placeholder="Padrão (token/frase ou regex)"
            value={newRulePattern}
            onChange={(e) => setNewRulePattern(e.target.value)}
          />
          <select
            className="px-3 py-2 border rounded text-sm"
            value={newRuleMatchType}
            onChange={(e) => setNewRuleMatchType(e.target.value as MatchType)}
          >
            <option value="exact">exato</option>
            <option value="contains">contém</option>
            <option value="regex">regex</option>
          </select>
        </div>
        <input
          className="px-3 py-2 border rounded w-full text-sm"
          placeholder="Sinônimos de unidade (separados por vírgula)"
          value={newRuleUnitSynonyms}
          onChange={(e) => setNewRuleUnitSynonyms(e.target.value)}
        />
        <button
          onClick={() => {
            if (!newRuleTarget || !newRulePattern) {
              toast.error("Selecione um produto e insira um padrão");
              return;
            }
            const p = addRule({
              pattern: newRulePattern,
              matchType: newRuleMatchType,
              targetProductId:
                newRuleTarget as unknown as Id<"canonicalProducts">,
              unitSynonyms: newRuleUnitSynonyms
                ? newRuleUnitSynonyms
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : undefined,
            });
            void p
              .then(() => {
                setNewRulePattern("");
                setNewRuleUnitSynonyms("");
                toast.success("Regra adicionada");
              })
              .catch((error: unknown) => {
                toast.error(error instanceof Error ? error.message : "Falha ao adicionar regra");
              });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded w-full hover:bg-blue-700 transition-colors"
        >
          Adicionar Regra
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma regra ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="p-2">Padrão</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Produto</th>
                <th className="p-2">Ativo</th>
                <th className="p-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r: MappingRule) => (
                <tr key={r._id} className="border-t">
                  <td className="p-2 break-all">{r.pattern}</td>
                  <td className="p-2">{r.matchType}</td>
                  <td className="p-2">
                    {products.find(
                      (p: CanonicalProduct) => p._id === r.targetProductId
                    )?.baseName ?? "-"}
                  </td>
                  <td className="p-2">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={(e) => {
                        const p = updateRule({
                          ruleId: r._id,
                          active: e.target.checked,
                        });
                          void p.catch((error: unknown) => {
                            toast.error(
                              error instanceof Error ? error.message : "Falha ao atualizar"
                            );
                          });
                        }}
                      />
                      <span>ativo</span>
                    </label>
                  </td>
                  <td className="p-2">
                    <button
                      className="text-red-600 hover:text-red-800"
                      onClick={() => {
                        const p = deleteRule({ ruleId: r._id });
                        void p
                          .then(() => {
                            toast.success("Regra excluída");
                          })
                          .catch((error: unknown) => {
                            toast.error(
                              error instanceof Error ? error.message : "Falha ao excluir"
                            );
                          });
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}