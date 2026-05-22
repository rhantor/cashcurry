"use client";

import React, { useState, useRef } from "react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";

export default function RecipeCostCalculator() {
  const calculatorRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [recipeDetails, setRecipeDetails] = useState({
    recipeName: "Signature Chicken Curry",
    category: "Main Course",
    yield: 4, // Number of portions
    targetFoodCostPercent: 30, // Target food cost % (industry standard is usually 28-35%)
  });

  const [ingredients, setIngredients] = useState([
    { id: 1, name: "Chicken Breast", unitCost: 15.00, unit: "kg", qtyUsed: 1.2 },
    { id: 2, name: "Curry Paste", unitCost: 25.00, unit: "kg", qtyUsed: 0.2 },
    { id: 3, name: "Coconut Milk", unitCost: 8.50, unit: "L", qtyUsed: 0.5 },
    { id: 4, name: "Onions", unitCost: 3.50, unit: "kg", qtyUsed: 0.4 },
    { id: 5, name: "Cooking Oil", unitCost: 5.00, unit: "L", qtyUsed: 0.1 },
  ]);

  const [additionalCosts, setAdditionalCosts] = useState({
    laborCost: 0,
    overheadCost: 0, // flat rate for gas, electricity, etc. per batch
  });

  // Handle Detail Changes
  const handleDetailChange = (field, value) => {
    setRecipeDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleAdditionalCostChange = (field, value) => {
    setAdditionalCosts(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
  };

  // Ingredient Operations
  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      { id: Date.now(), name: "", unitCost: 0, unit: "kg", qtyUsed: 0 }
    ]);
  };

  const updateIngredient = (id, field, value) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, [field]: value } : ing
    ));
  };

  const removeIngredient = (id) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  // Calculations
  const processedIngredients = ingredients.map(ing => {
    const cost = (parseFloat(ing.unitCost) || 0) * (parseFloat(ing.qtyUsed) || 0);
    return { ...ing, cost };
  });

  const totalIngredientCost = processedIngredients.reduce((acc, curr) => acc + curr.cost, 0);
  const totalCost = totalIngredientCost + additionalCosts.laborCost + additionalCosts.overheadCost;
  
  const portions = parseFloat(recipeDetails.yield) || 1;
  const costPerPortion = totalCost / portions;

  const targetPercentage = parseFloat(recipeDetails.targetFoodCostPercent) || 100;
  // If Target Food Cost is 30%, Selling Price = Cost / 0.30
  const suggestedSellingPrice = costPerPortion / (targetPercentage / 100);

  const formatCurrency = (val) => `RM ${parseFloat(val).toFixed(2)}`;

  const handlePrint = async () => {
    if (!calculatorRef.current) return;
    setIsGenerating(true);

    try {
      const dataUrl = await toPng(calculatorRef.current, { 
        quality: 1.0, 
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (calculatorRef.current.offsetHeight * pdfWidth) / calculatorRef.current.offsetWidth;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Recipe_Cost_${recipeDetails.recipeName.replace(/ /g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex flex-col md:flex-row gap-8 print:bg-white print:p-0 print:m-0">
      
      {/* Configuration Form */}
      <div className="w-full md:w-1/3 bg-white p-6 rounded-lg shadow-md h-fit overflow-y-auto max-h-[90vh] print:hidden">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Recipe Costing</h2>
        
        <div className="space-y-6">
          {/* Recipe Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">Recipe Details</h3>
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Recipe Name" value={recipeDetails.recipeName} onChange={(e) => handleDetailChange('recipeName', e.target.value)} />
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Category (e.g. Main Course)" value={recipeDetails.category} onChange={(e) => handleDetailChange('category', e.target.value)} />
            
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Yield (Portions)</label>
                <input type="number" className="w-full border p-2 rounded text-sm text-black" value={recipeDetails.yield} onChange={(e) => handleDetailChange('yield', e.target.value)} min="1" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Target Food Cost (%)</label>
                <input type="number" className="w-full border p-2 rounded text-sm text-black" value={recipeDetails.targetFoodCostPercent} onChange={(e) => handleDetailChange('targetFoodCostPercent', e.target.value)} min="1" max="100" />
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="text-lg font-semibold text-gray-800">Ingredients</h3>
              <button onClick={addIngredient} className="bg-mint-600 hover:bg-mint-700 text-white px-3 py-1 rounded text-xs font-medium">
                + Add Ingredient
              </button>
            </div>

            <div className="space-y-3">
              {ingredients.map((ing) => (
                <div key={ing.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
                  <button onClick={() => removeIngredient(ing.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600">✕</button>
                  <input type="text" className="w-full pr-6 border p-1.5 mb-2 rounded text-xs text-black font-semibold" placeholder="Ingredient Name" value={ing.name} onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)} />
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Unit Price</label>
                      <input type="number" className="w-full border p-1.5 rounded text-xs text-black" placeholder="0.00" value={ing.unitCost} onChange={(e) => updateIngredient(ing.id, 'unitCost', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Unit (e.g. kg)</label>
                      <input type="text" className="w-full border p-1.5 rounded text-xs text-black" placeholder="kg" value={ing.unit} onChange={(e) => updateIngredient(ing.id, 'unit', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Qty Used</label>
                      <input type="number" className="w-full border p-1.5 rounded text-xs text-black" placeholder="0" value={ing.qtyUsed} onChange={(e) => updateIngredient(ing.id, 'qtyUsed', parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              ))}
              {ingredients.length === 0 && <p className="text-xs text-gray-500 italic">No ingredients added.</p>}
            </div>
          </div>

          {/* Additional Costs */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">Additional Costs per Batch</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Labor Cost (RM)</label>
                <input type="number" className="w-full border p-2 rounded text-sm text-black" value={additionalCosts.laborCost} onChange={(e) => handleAdditionalCostChange('laborCost', e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Overhead/Misc (RM)</label>
                <input type="number" className="w-full border p-2 rounded text-sm text-black" value={additionalCosts.overheadCost} onChange={(e) => handleAdditionalCostChange('overheadCost', e.target.value)} />
              </div>
            </div>
          </div>

          <button 
            onClick={handlePrint} 
            disabled={isGenerating}
            className={`w-full text-white font-bold py-3 px-4 rounded mt-4 transition-colors ${isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isGenerating ? 'Generating PDF...' : 'Print / Save Report'}
          </button>
        </div>
      </div>

      {/* Calculator Preview */}
      <div className="w-full md:w-2/3 flex justify-center print:w-full print:block">
        <div 
          ref={calculatorRef} 
          className="bg-white shadow-lg print:shadow-none w-[210mm] min-h-[297mm] p-[15mm] box-border font-sans text-black flex flex-col relative" 
          style={{ backgroundColor: 'white' }}
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-4 border-mint-700 pb-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{recipeDetails.recipeName}</h1>
              <p className="text-sm text-mint-700 mt-1 font-bold uppercase tracking-widest">{recipeDetails.category}</p>
            </div>
            <div className="bg-mint-50 border border-mint-200 p-3 rounded-lg text-sm min-w-[180px]">
              <p className="flex justify-between mb-1"><span className="font-semibold text-gray-600">Batch Yield:</span> <span className="font-bold">{recipeDetails.yield} portions</span></p>
              <p className="flex justify-between"><span className="font-semibold text-gray-600">Target Food Cost:</span> <span className="font-bold">{recipeDetails.targetFoodCostPercent}%</span></p>
            </div>
          </div>

          {/* Ingredients Table */}
          <div className="mb-8">
            <h3 className="font-bold text-lg mb-2 text-gray-800">Ingredients Breakdown</h3>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-400">
                  <th className="border-x border-gray-300 px-3 py-2 text-left font-bold w-[45%]">Ingredient</th>
                  <th className="border-x border-gray-300 px-3 py-2 text-right font-bold w-[15%]">Unit Price</th>
                  <th className="border-x border-gray-300 px-3 py-2 text-right font-bold w-[20%]">Qty Used</th>
                  <th className="border-x border-gray-300 px-3 py-2 text-right font-bold w-[20%]">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {processedIngredients.map((ing, idx) => (
                  <tr key={ing.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-300 px-3 py-2 font-medium">{ing.name}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-gray-600">{formatCurrency(ing.unitCost)} / {ing.unit}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-gray-600">{ing.qtyUsed} {ing.unit}</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-bold text-gray-800">{formatCurrency(ing.cost)}</td>
                  </tr>
                ))}
                {processedIngredients.length === 0 && (
                  <tr>
                    <td colSpan="4" className="border border-gray-300 px-3 py-6 text-center text-gray-400 italic">No ingredients added yet.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-300 px-3 py-2 text-right text-gray-700" colSpan="3">Total Ingredients Cost</td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-gray-900">{formatCurrency(totalIngredientCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Cost Summary Section */}
          <div className="grid grid-cols-2 gap-8 mb-auto">
            {/* Left side: Additional Costs */}
            <div>
              <h3 className="font-bold text-lg mb-2 text-gray-800">Additional Costs</h3>
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 text-gray-700 bg-gray-50">Labor Cost (Batch)</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatCurrency(additionalCosts.laborCost)}</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-3 py-2 text-gray-700 bg-gray-50">Overhead / Misc</td>
                    <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatCurrency(additionalCosts.overheadCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right side: Final Metrics */}
            <div>
              <div className="bg-mint-50 border-2 border-mint-600 rounded-lg overflow-hidden shadow-sm">
                <div className="bg-mint-600 text-white px-4 py-2 font-bold text-center tracking-wide uppercase">
                  Recipe Economics
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-center border-b border-mint-200 pb-2">
                    <span className="text-gray-600 font-medium text-sm">Total Batch Cost:</span>
                    <span className="font-bold text-lg text-gray-900">{formatCurrency(totalCost)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-mint-200 pb-2">
                    <span className="text-gray-600 font-medium text-sm">Cost Per Portion:</span>
                    <span className="font-bold text-xl text-blue-700">{formatCurrency(costPerPortion)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <div>
                      <span className="block text-gray-600 font-medium text-sm">Suggested Selling Price:</span>
                      <span className="block text-[10px] text-gray-500 uppercase tracking-wider">At {recipeDetails.targetFoodCostPercent}% Food Cost</span>
                    </div>
                    <span className="font-bold text-2xl text-green-600">{formatCurrency(suggestedSellingPrice)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-12 pt-4 border-t border-gray-300 text-xs text-gray-500 text-center">
            <p>Generated on {new Date().toLocaleDateString()} | Confidential Costing Report</p>
          </div>
          
        </div>
      </div>
      
      {/* Global CSS for printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:w-full, .print\\:w-full * { visibility: visible; }
          .print\\:w-full {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page { size: A4; margin: 0; }
        }
      `}} />
    </div>
  );
}
