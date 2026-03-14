import { useState, useMemo } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Card, StatCard } from "@/components/ui/card";
import { SimpleBarChart, SimpleLineChart, DateNavigator } from "@/components/ui/simple-chart";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useData } from "@/lib/data-context";
import { useColors } from "@/hooks/use-colors";
import {
  formatCurrency, formatDate, todayFormatted, parseDateInput,
  shiftMonth, shiftYear, formatMonthRange, formatYearRange,
  getStartOfMonth, getEndOfMonth, isInRange,
} from "@/lib/calculations";

type RoloTab = "geral" | "compra" | "venda";

export default function RoloScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<RoloTab>("geral");

  const tabs: { key: RoloTab; label: string }[] = [
    { key: "geral", label: "Geral" },
    { key: "compra", label: "Compra" },
    { key: "venda", label: "Venda" },
  ];

  return (
    <ScreenContainer>
      <View className="px-5 pt-4 pb-2">
        <Text className="text-2xl font-bold text-foreground mb-3">Rolo</Text>
        <View className="flex-row gap-2 mb-2">
          {tabs.map((tab) => (
            <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: activeTab === tab.key ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: activeTab === tab.key ? colors.primary : colors.border,
              }}>
              <Text style={{ color: activeTab === tab.key ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {activeTab === "geral" && <GeralTab />}
      {activeTab === "compra" && <CompraTab />}
      {activeTab === "venda" && <VendaTab />}
    </ScreenContainer>
  );
}

// ==================== GERAL ====================
function GeralTab() {
  const { roloProducts, roloSales, roloWithdrawals, addRoloWithdrawal } = useData();
  const colors = useColors();
  const [yearRef, setYearRef] = useState(new Date());
  const [withdrawValue, setWithdrawValue] = useState("");
  const [withdrawDesc, setWithdrawDesc] = useState("");

  const totalGasto = useMemo(() => {
    return roloProducts.reduce((s, p) => s + (p.purchasePrice * p.quantity), 0);
  }, [roloProducts]);

  const totalGanho = useMemo(() => {
    return roloSales.reduce((s, sale) => s + sale.totalValue, 0);
  }, [roloSales]);

  const totalSaques = useMemo(() => {
    return roloWithdrawals.reduce((s, w) => s + w.value, 0);
  }, [roloWithdrawals]);

  const ganhoLiquido = totalGanho - totalGasto;
  const saldo = totalGanho - totalGasto - totalSaques;

  const dinheiroParado = useMemo(() => {
    return roloProducts.reduce((s, p) => {
      const remaining = p.quantity - p.quantitySold;
      return s + (remaining > 0 ? remaining * p.purchasePrice : 0);
    }, 0);
  }, [roloProducts]);

  const potencialGanho = useMemo(() => {
    return roloProducts.reduce((s, p) => {
      const remaining = p.quantity - p.quantitySold;
      return s + (remaining > 0 ? remaining * p.suggestedSalePrice : 0);
    }, 0);
  }, [roloProducts]);

  const crescimento = totalGasto > 0 ? ((totalGanho - totalGasto) / totalGasto) * 100 : 0;

  const year = yearRef.getFullYear();
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  const monthlyData = useMemo(() => {
    const gastosData = new Array(12).fill(0);
    const ganhosData = new Array(12).fill(0);
    const lucroData = new Array(12).fill(0);

    roloProducts.forEach((p) => {
      const d = new Date(p.date + "T12:00:00");
      if (d.getFullYear() === year) {
        gastosData[d.getMonth()] += p.purchasePrice * p.quantity;
      }
    });

    roloSales.forEach((s) => {
      const d = new Date(s.date + "T12:00:00");
      if (d.getFullYear() === year) {
        ganhosData[d.getMonth()] += s.totalValue;
      }
    });

    for (let i = 0; i < 12; i++) {
      lucroData[i] = ganhosData[i] - gastosData[i];
    }

    // Lucro acumulado - soma progressiva correta
    const lucroAcum = new Array(12).fill(0);
    let acumulado = 0;
    for (let i = 0; i < 12; i++) {
      acumulado += ganhosData[i] - gastosData[i];
      lucroAcum[i] = acumulado;
    }

    return { gastosData, ganhosData, lucroData, lucroAcum };
  }, [roloProducts, roloSales, year]);

  const handleSaque = async () => {
    if (!withdrawValue) {
      if (Platform.OS === "web") alert("Informe o valor do saque");
      else Alert.alert("Atenção", "Informe o valor do saque");
      return;
    }
    const val = parseFloat(withdrawValue.replace(",", "."));
    if (val > saldo) {
      if (Platform.OS === "web") alert("Saldo insuficiente no Rolo");
      else Alert.alert("Atenção", "Saldo insuficiente no Rolo");
      return;
    }
    await addRoloWithdrawal({
      value: val,
      description: withdrawDesc || "Saque para saldo geral",
      date: new Date().toISOString().split("T")[0],
    });
    setWithdrawValue("");
    setWithdrawDesc("");
    if (Platform.OS === "web") alert(`Saque de ${formatCurrency(val)} realizado!`);
    else Alert.alert("Sucesso", `Saque de ${formatCurrency(val)} realizado!`);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Saldo Rolo" value={formatCurrency(saldo)}
            icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={saldo >= 0 ? colors.success : colors.error} />} />
          <StatCard title="Ganho Líquido" value={formatCurrency(ganhoLiquido)}
            icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={ganhoLiquido >= 0 ? colors.success : colors.error} />} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Dinheiro Parado" value={formatCurrency(dinheiroParado)}
            icon={<IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.warning} />} />
          <StatCard title="Potencial de Ganho" value={formatCurrency(potencialGanho)}
            icon={<IconSymbol name="arrow.up.circle.fill" size={16} color={colors.success} />} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Crescimento" value={`${crescimento.toFixed(1)}%`}
            icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={crescimento >= 0 ? colors.success : colors.error} />} />
          <StatCard title="Saques" value={formatCurrency(totalSaques)}
            icon={<IconSymbol name="arrow.down.circle.fill" size={16} color={colors.muted} />} />
        </View>
        <View className="flex-row gap-3 mb-4">
          <StatCard title="Total Gasto" value={formatCurrency(totalGasto)}
            icon={<IconSymbol name="cart.fill" size={16} color={colors.error} />} />
          <StatCard title="Total Ganho" value={formatCurrency(totalGanho)}
            icon={<IconSymbol name="tag.fill" size={16} color={colors.success} />} />
        </View>

        {(monthlyData.lucroData.some((v: number) => v !== 0)) && (
          <Card title="Lucro por Mês" className="mb-4">
            <DateNavigator label={formatYearRange(yearRef)}
              onPrev={() => setYearRef(shiftYear(yearRef, -1))}
              onNext={() => setYearRef(shiftYear(yearRef, 1))} />
            <SimpleBarChart
              labels={monthNames}
              data={monthlyData.lucroData}
              color="#4ADE80"
              height={160} showValues showTotal
            />
          </Card>
        )}

        {(monthlyData.lucroAcum.some((v) => v !== 0)) && (
          <Card title="Lucro Acumulado" className="mb-4">
            <DateNavigator label={formatYearRange(yearRef)}
              onPrev={() => setYearRef(shiftYear(yearRef, -1))}
              onNext={() => setYearRef(shiftYear(yearRef, 1))} />
            <SimpleLineChart
              labels={monthNames}
              datasets={[
                { data: monthlyData.lucroAcum, color: "#4ADE80", label: "Lucro Acumulado" },
              ]}
              height={180} width={340} showTotal
            />
          </Card>
        )}

        {(monthlyData.gastosData.some((v) => v !== 0) || monthlyData.ganhosData.some((v) => v !== 0)) && (
          <Card title="Gastos vs Ganhos (Mensal)" className="mb-4">
            <SimpleBarChart
              labels={monthNames}
              data={monthlyData.ganhosData}
              secondaryData={monthlyData.gastosData}
              color="#4ADE80"
              secondaryColor="#F87171"
              height={180} showValues showTotal
            />
          </Card>
        )}

        <Card title="Saque para Saldo Geral" className="mb-4">
          <Text className="text-xs text-muted mb-2">
            Transfira valores do saldo "Rolo" para o saldo geral do aplicativo.
          </Text>
          <Text className="text-xs text-muted mb-1 uppercase">Descrição</Text>
          <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-2"
            placeholder="Ex: Lucro da semana" placeholderTextColor={colors.muted}
            value={withdrawDesc} onChangeText={setWithdrawDesc} returnKeyType="done" />
          <Text className="text-xs text-muted mb-1 uppercase">Valor (R$)</Text>
          <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
            placeholder="0,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
            value={withdrawValue} onChangeText={setWithdrawValue} returnKeyType="done" />
          <TouchableOpacity onPress={handleSaque}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Realizar Saque</Text>
          </TouchableOpacity>
        </Card>

        {roloWithdrawals.length > 0 && (
          <>
            <Text className="text-sm font-semibold text-muted mb-2 uppercase">Saques Realizados</Text>
            {[...roloWithdrawals].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((w) => (
              <View key={w.id} className="flex-row items-center bg-surface border border-border rounded-xl p-3 mb-2">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{w.description}</Text>
                  <Text className="text-xs text-muted">{formatDate(w.date)}</Text>
                </View>
                <Text className="text-sm font-bold mr-2" style={{ color: colors.warning }}>
                  -{formatCurrency(w.value)}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ==================== COMPRA ====================
function CompraTab() {
  const { roloProducts, addRoloProduct, removeRoloProduct } = useData();
  const colors = useColors();
  const [name, setName] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [profitMargin, setProfitMargin] = useState("50");
  const [suggestedPrice, setSuggestedPrice] = useState("");
  const [date, setDate] = useState(todayFormatted());

  const calcSuggestedPrice = () => {
    const price = parseFloat(purchasePrice.replace(",", ".")) || 0;
    const margin = parseFloat(profitMargin.replace(",", ".")) || 0;
    const suggested = price + (price * margin / 100);
    setSuggestedPrice(suggested.toFixed(2).replace(".", ","));
  };

  const handleSave = async () => {
    if (!name || !purchasePrice || !quantity) {
      if (Platform.OS === "web") alert("Preencha todos os campos obrigatórios");
      else Alert.alert("Atenção", "Preencha todos os campos obrigatórios");
      return;
    }
    const price = parseFloat(purchasePrice.replace(",", "."));
    const qty = parseInt(quantity) || 1;
    const margin = parseFloat(profitMargin.replace(",", ".")) || 0;
    const salePrice = suggestedPrice
      ? parseFloat(suggestedPrice.replace(",", "."))
      : price + (price * margin / 100);

    await addRoloProduct({
      name,
      purchasePrice: price,
      quantity: qty,
      quantitySold: 0,
      suggestedSalePrice: salePrice,
      profitMargin: margin,
      date: parseDateInput(date),
    });

    setName("");
    setPurchasePrice("");
    setQuantity("1");
    setProfitMargin("50");
    setSuggestedPrice("");
    if (Platform.OS === "web") alert("Produto cadastrado com sucesso!");
    else Alert.alert("Sucesso", "Produto cadastrado com sucesso!");
  };

  const handleDelete = (product: typeof roloProducts[0]) => {
    const doDelete = () => removeRoloProduct(product.id);
    if (Platform.OS === "web") {
      if (confirm(`Excluir "${product.name}"? O valor será estornado do saldo Rolo.`)) doDelete();
    } else {
      Alert.alert("Confirmar", `Excluir "${product.name}"? O valor será estornado do saldo Rolo.`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const sorted = [...roloProducts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Nova Compra</Text>

        <Text className="text-xs text-muted mb-1 uppercase">Nome do Produto</Text>
        <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
          placeholder="Ex: Capinha de celular" placeholderTextColor={colors.muted}
          value={name} onChangeText={setName} returnKeyType="done" />

        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Valor de Compra (R$)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="0,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={purchasePrice} onChangeText={setPurchasePrice} returnKeyType="done"
              onBlur={calcSuggestedPrice} />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Quantidade</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="1" placeholderTextColor={colors.muted} keyboardType="number-pad"
              value={quantity} onChangeText={setQuantity} returnKeyType="done" />
          </View>
        </View>

        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Margem de Lucro (%)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="30" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={profitMargin} onChangeText={setProfitMargin} returnKeyType="done"
              onBlur={calcSuggestedPrice} />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Preço de Venda (R$)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Sugerido" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={suggestedPrice} onChangeText={setSuggestedPrice} returnKeyType="done" />
          </View>
        </View>

        <Text className="text-xs text-muted mb-1 uppercase">Data da Compra</Text>
        <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
          placeholder="DD/MM/AA" placeholderTextColor={colors.muted}
          value={date} onChangeText={setDate} returnKeyType="done" />

        {purchasePrice && quantity && (
          <View className="bg-surface border border-border rounded-xl p-3 mb-3">
            <Text className="text-xs text-muted">
              Total da compra: {formatCurrency(parseFloat(purchasePrice.replace(",", ".") || "0") * (parseInt(quantity) || 1))}
              {suggestedPrice ? ` | Venda estimada: ${formatCurrency(parseFloat(suggestedPrice.replace(",", ".") || "0") * (parseInt(quantity) || 1))}` : ""}
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={handleSave}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Cadastrar Compra</Text>
        </TouchableOpacity>

        <Text className="text-sm font-semibold text-muted mt-5 mb-2 uppercase">Estoque</Text>
        {sorted.map((p) => {
          const remaining = p.quantity - p.quantitySold;
          return (
            <View key={p.id} className="bg-surface border border-border rounded-xl p-3 mb-2">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{p.name}</Text>
                  <Text className="text-xs text-muted">
                    {formatDate(p.date)} | Compra: {formatCurrency(p.purchasePrice)} | Venda: {formatCurrency(p.suggestedSalePrice)}
                  </Text>
                  <Text className="text-xs" style={{ color: remaining > 0 ? colors.warning : colors.success }}>
                    Estoque: {remaining}/{p.quantity} {remaining === 0 ? "(Vendido)" : ""}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(p)} style={{ padding: 4 }}>
                  <IconSymbol name="trash.fill" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {sorted.length === 0 && <Text className="text-sm text-muted text-center py-4">Nenhum produto cadastrado</Text>}
      </View>
    </ScrollView>
  );
}

// ==================== VENDA ====================
function VendaTab() {
  const { roloProducts, roloSales, addRoloSale, removeRoloSale, updateRoloProduct } = useData();
  const colors = useColors();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [salePrice, setSalePrice] = useState("");
  const [date, setDate] = useState(todayFormatted());

  const availableProducts = roloProducts.filter((p) => p.quantity - p.quantitySold > 0);

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    const product = roloProducts.find((p) => p.id === id);
    if (product) {
      setSalePrice(product.suggestedSalePrice.toFixed(2).replace(".", ","));
    }
  };

  const handleSale = async () => {
    if (!selectedProductId || !saleQuantity || !salePrice) {
      if (Platform.OS === "web") alert("Selecione um produto e preencha os campos");
      else Alert.alert("Atenção", "Selecione um produto e preencha os campos");
      return;
    }
    const product = roloProducts.find((p) => p.id === selectedProductId);
    if (!product) return;

    const qty = parseInt(saleQuantity) || 1;
    const remaining = product.quantity - product.quantitySold;
    if (qty > remaining) {
      if (Platform.OS === "web") alert(`Estoque insuficiente. Disponível: ${remaining}`);
      else Alert.alert("Atenção", `Estoque insuficiente. Disponível: ${remaining}`);
      return;
    }

    const price = parseFloat(salePrice.replace(",", "."));
    const totalValue = price * qty;

    await addRoloSale({
      productId: product.id,
      productName: product.name,
      quantity: qty,
      salePrice: price,
      totalValue,
      date: parseDateInput(date),
    });

    await updateRoloProduct(product.id, {
      quantitySold: product.quantitySold + qty,
    });

    setSaleQuantity("1");
    setSalePrice("");
    setSelectedProductId("");
    if (Platform.OS === "web") alert(`Venda de ${qty}x ${product.name} registrada!`);
    else Alert.alert("Sucesso", `Venda de ${qty}x ${product.name} registrada!`);
  };

  const handleDeleteSale = (sale: typeof roloSales[0]) => {
    const doDelete = async () => {
      const product = roloProducts.find((p) => p.id === sale.productId);
      if (product) {
        await updateRoloProduct(product.id, {
          quantitySold: Math.max(0, product.quantitySold - sale.quantity),
        });
      }
      await removeRoloSale(sale.id);
    };
    if (Platform.OS === "web") {
      if (confirm(`Excluir venda de "${sale.productName}"? O estoque será restaurado.`)) doDelete();
    } else {
      Alert.alert("Confirmar", `Excluir venda de "${sale.productName}"? O estoque será restaurado.`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Excluir", style: "destructive", onPress: doDelete },
      ]);
    }
  };

  const sortedSales = [...roloSales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Nova Venda</Text>

        <Text className="text-xs text-muted mb-1 uppercase">Selecionar Produto</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {availableProducts.map((p) => {
            const remaining = p.quantity - p.quantitySold;
            return (
              <TouchableOpacity key={p.id} onPress={() => handleSelectProduct(p.id)}
                style={{
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginRight: 8,
                  backgroundColor: selectedProductId === p.id ? colors.primary : colors.surface,
                  borderWidth: 1, borderColor: selectedProductId === p.id ? colors.primary : colors.border,
                  minWidth: 100,
                }}>
                <Text style={{ color: selectedProductId === p.id ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "600" }}>
                  {p.name}
                </Text>
                <Text style={{ color: selectedProductId === p.id ? "#fff" : colors.muted, fontSize: 10 }}>
                  Estoque: {remaining} | {formatCurrency(p.suggestedSalePrice)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {availableProducts.length === 0 && (
          <Text className="text-sm text-muted text-center py-4 mb-3">Nenhum produto com estoque disponível</Text>
        )}

        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Quantidade</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="1" placeholderTextColor={colors.muted} keyboardType="number-pad"
              value={saleQuantity} onChangeText={setSaleQuantity} returnKeyType="done" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Preço de Venda (R$)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="0,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={salePrice} onChangeText={setSalePrice} returnKeyType="done" />
          </View>
        </View>

        <Text className="text-xs text-muted mb-1 uppercase">Data da Venda</Text>
        <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
          placeholder="DD/MM/AA" placeholderTextColor={colors.muted}
          value={date} onChangeText={setDate} returnKeyType="done" />

        {selectedProductId && salePrice && saleQuantity && (
          <View className="bg-surface border border-border rounded-xl p-3 mb-3">
            <Text className="text-xs text-muted">
              Total da venda: {formatCurrency(parseFloat(salePrice.replace(",", ".") || "0") * (parseInt(saleQuantity) || 1))}
            </Text>
          </View>
        )}

        <TouchableOpacity onPress={handleSale}
          style={{ backgroundColor: colors.success, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Registrar Venda</Text>
        </TouchableOpacity>

        <Text className="text-sm font-semibold text-muted mt-5 mb-2 uppercase">Histórico de Vendas</Text>
        {sortedSales.map((sale) => {
          const product = roloProducts.find((p) => p.id === sale.productId);
          const lucroUnit = product ? sale.salePrice - product.purchasePrice : 0;
          const lucroTotal = lucroUnit * sale.quantity;
          return (
            <View key={sale.id} className="bg-surface border border-border rounded-xl p-3 mb-2">
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    {sale.productName} ({sale.quantity}x)
                  </Text>
                  <Text className="text-xs text-muted">
                    {formatDate(sale.date)} | Preço: {formatCurrency(sale.salePrice)} | Total: {formatCurrency(sale.totalValue)}
                  </Text>
                  <Text className="text-xs" style={{ color: lucroTotal >= 0 ? colors.success : colors.error }}>
                    Lucro: {formatCurrency(lucroTotal)} ({product && product.purchasePrice > 0 ? ((lucroUnit / product.purchasePrice) * 100).toFixed(1) : "0.0"}%)
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteSale(sale)} style={{ padding: 4 }}>
                  <IconSymbol name="trash.fill" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        {sortedSales.length === 0 && <Text className="text-sm text-muted text-center py-4">Nenhuma venda registrada</Text>}
      </View>
    </ScrollView>
  );
}
