"use client";

import { useEffect, useState } from "react";
import { supabase, FarmCrop } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { Edit2, Trash2, X } from "lucide-react";

type Recipe = {
  id: string;
  recipe_name: string;
  output_crop_name: string;
  output_unit: string;
};

type RecipeItem = {
  id: string;
  input_crop_name: string;
  input_unit: string;
  input_per_output: number;
};

export default function ProcessingRecipesPage() {
  const { farm, initialized, initialize, cropIconMap } = useAuthStore();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [farmCrops, setFarmCrops] = useState<FarmCrop[]>([]);
  const [recipeName, setRecipeName] = useState("");
  const [outputCrop, setOutputCrop] = useState("");
  const [outputUnit, setOutputUnit] = useState("kg");
  const [inputCrop, setInputCrop] = useState("");
  const [inputPerOutput, setInputPerOutput] = useState("0.2");
  const [saving, setSaving] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editingItem, setEditingItem] = useState<RecipeItem | null>(null);

  useEffect(() => {
    if (!initialized) initialize();
  }, [initialized, initialize]);

  const load = async () => {
    if (!farm?.id) return;
    const [recipeRes, cropsRes] = await Promise.all([
      supabase
        .from("processing_recipes")
        .select("id, recipe_name, output_crop_name, output_unit")
        .eq("farm_id", farm.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("farm_crops")
        .select("*")
        .eq("farm_id", farm.id)
        .eq("is_active", true)
        .or("is_temporary.is.null,is_temporary.eq.false")
        .order("sort_order"),
    ]);

    if (recipeRes.error) {
      toast.error("레시피 조회 실패: " + recipeRes.error.message);
      return;
    }

    if (cropsRes.error) {
      toast.error("품목 조회 실패: " + cropsRes.error.message);
      return;
    }

    setRecipes((recipeRes.data ?? []) as Recipe[]);
    setFarmCrops((cropsRes.data ?? []) as FarmCrop[]);
  };

  useEffect(() => {
    load();
  }, [farm?.id]);

  const processedCrops = farmCrops.filter((c) => c.category === "processed");
  const rawCrops = farmCrops.filter((c) => c.category === "crop");

  const saveRecipe = async () => {
    if (!farm?.id) return;
    if (!recipeName.trim() || !outputCrop || !inputCrop) {
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
      if (editingRecipe && editingItem) {
        // 수정 모드
        await supabase
          .from("processing_recipes")
          .update({
            recipe_name: recipeName.trim(),
            output_crop_name: outputCrop,
            output_unit: outputUnit,
          })
          .eq("id", editingRecipe.id);

        await supabase
          .from("processing_recipe_items")
          .update({
            input_crop_name: inputCrop,
            input_unit: "kg",
            input_per_output: ratio,
          })
          .eq("id", editingItem.id);

        toast.success("레시피 수정 완료");
      } else {
        // 신규 등록
        const { data: recipe, error: recipeError } = await supabase
          .from("processing_recipes")
          .insert({
            farm_id: farm.id,
            recipe_name: recipeName.trim(),
            output_crop_name: outputCrop,
            output_unit: outputUnit,
          })
          .select("id")
          .single();

        if (recipeError) throw recipeError;

        const { error: itemError } = await supabase
          .from("processing_recipe_items")
          .insert({
            recipe_id: recipe.id,
            input_crop_name: inputCrop,
            input_unit: "kg",
            input_per_output: ratio,
          });

        if (itemError) throw itemError;

        toast.success("레시피 저장 완료");
      }

      setRecipeName("");
      setOutputCrop("");
      setOutputUnit("kg");
      setInputCrop("");
      setInputPerOutput("0.2");
      setEditingRecipe(null);
      setEditingItem(null);
      load();
    } catch (e) {
      toast.error("저장 실패: " + ((e as Error).message || "알 수 없는 오류"));
    } finally {
      setSaving(false);
    }
  };

  const editRecipe = async (recipe: Recipe) => {
    const { data, error } = await supabase
      .from("processing_recipe_items")
      .select("*")
      .eq("recipe_id", recipe.id)
      .single();

    if (error || !data) {
      toast.error("레시피 로드 실패");
      return;
    }

    setEditingRecipe(recipe);
    setEditingItem(data as RecipeItem);
    setRecipeName(recipe.recipe_name);
    setOutputCrop(recipe.output_crop_name);
    setOutputUnit(recipe.output_unit);
    setInputCrop(data.input_crop_name);
    setInputPerOutput(data.input_per_output.toString());
  };

  const deleteRecipe = async (recipeId: string) => {
    if (!confirm("레시피를 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("processing_recipes")
      .update({ is_active: false })
      .eq("id", recipeId);

    if (error) {
      toast.error("삭제 실패: " + error.message);
      return;
    }

    toast.success("레시피 삭제 완료");
    load();
  };

  const cancelEdit = () => {
    setEditingRecipe(null);
    setEditingItem(null);
    setRecipeName("");
    setOutputCrop("");
    setOutputUnit("kg");
    setInputCrop("");
    setInputPerOutput("0.2");
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-black text-gray-900">가공 레시피 관리</h1>
        <p className="text-xs text-gray-500 mt-1">
          가공품 1단위당 필요한 원물량을 등록합니다. (정식 품목만 사용 가능)
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
        {editingRecipe && (
          <div className="flex items-center justify-between pb-2 border-b border-gray-200">
            <p className="text-xs font-bold text-indigo-600">수정 모드</p>
            <button onClick={cancelEdit} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}

        <input
          className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
          placeholder="레시피명 (예: 딸기청 기본)"
          value={recipeName}
          onChange={(e) => setRecipeName(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          <select
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
            value={outputCrop}
            onChange={(e) => setOutputCrop(e.target.value)}
          >
            <option value="">산출 가공품 선택</option>
            {processedCrops.map((c) => (
              <option key={c.id} value={c.crop_name}>
                {cropIconMap[c.crop_name] || "🎁"} {c.crop_name}
              </option>
            ))}
          </select>
          <select
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
            value={outputUnit}
            onChange={(e) => setOutputUnit(e.target.value)}
          >
            {["kg", "g", "개", "병", "박스", "세트"].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <select
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
            value={inputCrop}
            onChange={(e) => setInputCrop(e.target.value)}
          >
            <option value="">투입 원물 선택</option>
            {rawCrops.map((c) => (
              <option key={c.id} value={c.crop_name}>
                {cropIconMap[c.crop_name] || "🌱"} {c.crop_name}
              </option>
            ))}
          </select>
          <input
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm"
            placeholder="가공품 1당 원물 소요량"
            value={inputPerOutput}
            onChange={(e) => setInputPerOutput(e.target.value)}
          />
        </div>

        {(processedCrops.length === 0 || rawCrops.length === 0) && (
          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
            ⚠️ 설정 페이지에서 원물/가공품을 먼저 등록해주세요. (임시 가공품은 사용 불가)
          </p>
        )}

        <button
          onClick={saveRecipe}
          disabled={saving || processedCrops.length === 0 || rawCrops.length === 0}
          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : editingRecipe ? "레시피 수정" : "레시피 저장"}
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
            <div
              key={r.id}
              className="p-3 bg-white border border-gray-200 rounded-xl text-sm flex items-center justify-between"
            >
              <div>
                <span className="font-black text-gray-800">{r.recipe_name}</span>
                <span className="text-gray-500">
                  {" "}
                  · {cropIconMap[r.output_crop_name] || "🎁"} {r.output_crop_name} ({r.output_unit})
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => editRecipe(r)}
                  className="p-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                </button>
                <button
                  onClick={() => deleteRecipe(r.id)}
                  className="p-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
