"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

type Recipe = {
  id: string;
  recipe_name: string;
  output_crop_name: string;
  output_unit: string;
};

export default function ProcessingRecipesPage() {
  const { farm, initialized, initialize } = useAuthStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipeName, setRecipeName] = useState("");
  const [outputCrop, setOutputCrop] = useState("");
  const [outputUnit, setOutputUnit] = useState("kg");
  const [inputCrop, setInputCrop] = useState("");
  const [inputPerOutput, setInputPerOutput] = useState("0.2");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  const load = async () => {
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

  useEffect(() => {
    load();
  }, [farm?.id]);

  const saveRecipe = async () => {
    if (!farm?.id) return;
    if (!recipeName.trim() || !outputCrop.trim() || !inputCrop.trim()) {
      toast.error("레시피명, 산출품, 투입 원물은 필수입니다.");
      return;
    }

    const ratio = Number(inputPerOutput);
    if (!Number.isFinite(ratio) || ratio <= 0) {
      toast.error("원물 소요량은 0보다 큰 숫자여야 합니다.");
      return;
    }

    setSaving(true);
    try {
      const { data: recipe, error: recipeError } = await supabase
        .from("processing_recipes")
        .insert({
          farm_id: farm.id,
          recipe_name: recipeName.trim(),
          output_crop_name: outputCrop.trim(),
          output_unit: outputUnit,
        })
        .select("id")
        .single();

      if (recipeError) throw recipeError;

      const { error: itemError } = await supabase
        .from("processing_recipe_items")
        .insert({
          recipe_id: recipe.id,
          input_crop_name: inputCrop.trim(),
          input_unit: "kg",
          input_per_output: ratio,
        });

      if (itemError) throw itemError;

      toast.success("레시피 저장 완료");
      setRecipeName("");
      setOutputCrop("");
      setOutputUnit("kg");
      setInputCrop("");
      setInputPerOutput("0.2");
      load();
    } catch (e) {
      toast.error("저장 실패: " + ((e as Error).message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900">가공 레시피 관리</h1>
        <p className="text-xs text-gray-500 mt-1">가공품 1단위당 필요한 원물량을 등록합니다.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
        <input
          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
          placeholder="레시피명 (예: 딸기청 기본)"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
            placeholder="산출 가공품 (예: 딸기청)"
            value={outputCrop}
            onChange={(e) => setOutputCrop(e.target.value)}
          />
          <select
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
            value={outputUnit}
            onChange={(e) => setOutputUnit(e.target.value)}
          >
            {["kg", "g", "개", "병", "박스", "세트"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
            placeholder="투입 원물 (예: 딸기)"
            value={inputCrop}
            onChange={(e) => setInputCrop(e.target.value)}
          />
          <input
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
            placeholder="가공품 1당 원물 소요량"
            value={inputPerOutput}
            onChange={(e) => setInputPerOutput(e.target.value)}
          />
        </div>

        <button
          onClick={saveRecipe}
          disabled={saving}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "레시피 저장"}
        </button>
      </div>

      <section className="space-y-2">
        <p className="text-xs font-black text-gray-500">등록된 레시피</p>
        {recipes.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-2xl">
            아직 등록된 레시피가 없습니다.
          </div>
        ) : (
          recipes.map((r) => (
            <div key={r.id} className="p-3 bg-white border border-gray-200 rounded-xl text-sm">
              <span className="font-black text-gray-800">{r.recipe_name}</span>
              <span className="text-gray-500"> · {r.output_crop_name} ({r.output_unit})</span>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
