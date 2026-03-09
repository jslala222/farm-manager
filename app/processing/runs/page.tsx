"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { formatKSTDate, getNowKST, toKSTDateString } from "@/lib/utils";
import { toast } from "sonner";

type Recipe = {
  id: string;
  recipe_name: string;
  output_crop_name: string;
  output_unit: string;
};

type RecipeItem = {
  input_crop_name: string;
  input_per_output: number;
};

export default function ProcessingRunsPage() {
  const { farm, initialized, initialize } = useAuthStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);
  const [recipeId, setRecipeId] = useState("");
  const [runDate, setRunDate] = useState(toKSTDateString());
  const [inputQty, setInputQty] = useState("300");
  const [actualOutputQty, setActualOutputQty] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const nowKSTTimestamp = () => formatKSTDate(getNowKST());

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  useEffect(() => {
    const loadRecipes = async () => {
      if (!farm?.id) return;

      const { data, error } = await supabase
        .from("processing_recipes")
        .select("id, recipe_name, output_crop_name, output_unit")
        .eq("farm_id", farm.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("레시피 조회 실패: " + error.message);
        return;
      }

      setRecipes((data ?? []) as Recipe[]);
    };

    loadRecipes();
  }, [farm?.id]);

  useEffect(() => {
    const loadItems = async () => {
      if (!recipeId) {
        setRecipeItems([]);
        return;
      }

      const { data, error } = await supabase
        .from("processing_recipe_items")
        .select("input_crop_name, input_per_output")
        .eq("recipe_id", recipeId)
        .order("created_at", { ascending: true });

      if (error) {
        toast.error("레시피 구성 조회 실패: " + error.message);
        return;
      }

      setRecipeItems((data ?? []) as RecipeItem[]);
    };

    loadItems();
  }, [recipeId]);

  const selectedRecipe = useMemo(
    () => recipes.find((r) => r.id === recipeId),
    [recipes, recipeId]
  );

  // v1: 첫 번째 원물 비율을 기준으로 예상 산출량 계산
  const primaryItem = recipeItems[0];
  const expectedOutputQty = useMemo(() => {
    const inQty = Number(inputQty || 0);
    const per = Number(primaryItem?.input_per_output || 0);
    if (!Number.isFinite(inQty) || !Number.isFinite(per) || inQty <= 0 || per <= 0) return 0;
    return inQty / per;
  }, [inputQty, primaryItem]);

  const saveRun = async () => {
    if (!farm?.id) return;
    if (!selectedRecipe || !primaryItem) {
      toast.error("레시피를 선택해주세요.");
      return;
    }

    const inQty = Number(inputQty);
    if (!Number.isFinite(inQty) || inQty <= 0) {
      toast.error("투입 원물량을 확인해주세요.");
      return;
    }

    const actualQty = Number(actualOutputQty || expectedOutputQty);
    if (!Number.isFinite(actualQty) || actualQty <= 0) {
      toast.error("실제 산출량을 확인해주세요.");
      return;
    }

    setSaving(true);
    try {
      const { data: run, error: runError } = await supabase
        .from("processing_runs")
        .insert({
          farm_id: farm.id,
          recipe_id: selectedRecipe.id,
          run_date: runDate,
          input_qty: inQty,
          expected_output_qty: expectedOutputQty,
          actual_output_qty: actualQty,
          output_crop_name: selectedRecipe.output_crop_name,
          output_unit: selectedRecipe.output_unit,
          memo: memo.trim() || null,
        })
        .select("id")
        .single();

      if (runError) throw runError;

      const { error: adjustmentError } = await supabase
        .from("inventory_adjustments")
        .insert([
          {
            farm_id: farm.id,
            crop_name: primaryItem.input_crop_name,
            quantity: -Math.abs(inQty),
            adjustment_type: "process_out",
            reason: `레시피 생산 투입 (${run.id})`,
            adjusted_at: nowKSTTimestamp(),
          },
          {
            farm_id: farm.id,
            crop_name: selectedRecipe.output_crop_name,
            quantity: actualQty,
            adjustment_type: "process_in",
            reason: `레시피 생산 산출 (${run.id})`,
            adjusted_at: nowKSTTimestamp(),
          },
        ]);

      if (adjustmentError) throw adjustmentError;

      toast.success("생산 확정이 저장되었습니다.");
      setInputQty("300");
      setActualOutputQty("");
      setMemo("");
    } catch (e) {
      toast.error("저장 실패: " + ((e as Error).message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900">가공 생산 확정</h1>
        <p className="text-xs text-gray-500 mt-1">투입 원물량으로 예상 산출을 계산하고 실제 산출을 확정합니다.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <select
          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
          value={recipeId}
          onChange={(e) => setRecipeId(e.target.value)}
        >
          <option value="">레시피 선택</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.recipe_name}
            </option>
          ))}
        </select>

        <input
          type="date"
          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
          value={runDate}
          onChange={(e) => setRunDate(e.target.value)}
        />

        <input
          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
          value={inputQty}
          onChange={(e) => setInputQty(e.target.value)}
          placeholder="투입 원물량 (kg)"
        />

        <div className="text-sm font-black text-gray-700">
          예상 산출량: {expectedOutputQty.toFixed(1)} {selectedRecipe?.output_unit ?? ""}
        </div>

        <input
          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
          value={actualOutputQty}
          onChange={(e) => setActualOutputQty(e.target.value)}
          placeholder="실제 산출량 (미입력 시 예상 산출량 사용)"
        />

        <input
          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모"
        />

        <button
          onClick={saveRun}
          disabled={saving}
          className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "생산 확정 저장"}
        </button>
      </div>

      {selectedRecipe && primaryItem && (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
          기준 비율: {selectedRecipe.output_crop_name} 1 {selectedRecipe.output_unit} 생산에
          {" "}{primaryItem.input_crop_name} {primaryItem.input_per_output}kg 사용
        </div>
      )}
    </div>
  );
}
