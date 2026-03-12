import { useState, useMemo } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, Platform, Switch } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Card, StatCard } from "@/components/ui/card";
import { SimpleBarChart, SimpleLineChart, DateNavigator } from "@/components/ui/simple-chart";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useData } from "@/lib/data-context";
import { useColors } from "@/hooks/use-colors";
import { MaintenanceDB } from "@/lib/database";
import {
  calcTotalEarnings, calcTotalEarningsReceived, calcTotalEarningsPending,
  calcTotalExpenses, calcTotalIncome, calcUpcomingBills, calcOverdueBills,
  calcTotalExtraIncome, calcTotalKm,
  getWeekBills, getCategorySpending,
  getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth,
  getStartOfYear, getEndOfYear,
  getMonthlyDailyData,
  formatCurrency, formatDate, todayFormatted, todayStr,
  parseDateInput, isInRange,
  shiftWeek, shiftMonth, shiftYear, formatWeekRange, formatMonthRange, formatYearRange,
  getAppColor,
} from "@/lib/calculations";

// AJUSTE 4/5: 6 sub-abas incluindo nova aba "Gráficos" e "Configurações"
type SubTab = "visao_geral" | "lancamento" | "contas_mensais" | "graficos" | "relatorio" | "configuracoes";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "visao_geral", label: "Visão Geral" },
  { key: "lancamento", label: "Lançamento" },
  { key: "contas_mensais", label: "Contas Mensais" },
  { key: "graficos", label: "Gráficos" },
  { key: "relatorio", label: "Relatório" },
  { key: "configuracoes", label: "Configurações" },
];

export default function FinanceiroScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>("visao_geral");
  const colors = useColors();

  return (
    <ScreenContainer>
      {/* AJUSTE 6: Sub-abas padronizadas - mesmo estilo pill/chip em todas as abas */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        {SUB_TABS.map((tab) => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}
            style={{
              paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginRight: 8,
              backgroundColor: activeTab === tab.key ? colors.primary : "transparent",
              borderWidth: 1, borderColor: activeTab === tab.key ? colors.primary : colors.border,
            }}>
            <Text style={{
              color: activeTab === tab.key ? "#fff" : colors.muted,
              fontWeight: activeTab === tab.key ? "700" : "500", fontSize: 12,
            }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === "visao_geral" && <VisaoGeralTab />}
      {activeTab === "lancamento" && <LancamentoTab />}
      {activeTab === "contas_mensais" && <ContasMensaisTab />}
      {activeTab === "graficos" && <GraficosTab />}
      {activeTab === "relatorio" && <RelatorioTab />}
      {activeTab === "configuracoes" && <ConfiguracoesTab />}
    </ScreenContainer>
  );
}

// ==================== VISÃO GERAL ====================
function VisaoGeralTab() {
  const { earnings, dailyKms, maintenance, financials, extraIncomes, config } = useData();
  const colors = useColors();
  const [weekRef, setWeekRef] = useState(new Date());
  const [monthRef, setMonthRef] = useState(new Date());

  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const weekEnd = getEndOfWeek(now);
  const monthStart = getStartOfMonth(now);
  const monthEnd = getEndOfMonth(now);

  const weeklyEarnings = calcTotalEarnings(earnings, weekStart, weekEnd);
  const monthlyEarnings = calcTotalEarnings(earnings, monthStart, monthEnd);
  const totalKm = calcTotalKm(dailyKms, monthStart, monthEnd);
  const monthlyPending = calcTotalEarningsPending(earnings, monthStart, monthEnd);
  const extraTotal = calcTotalExtraIncome(extraIncomes, monthStart, monthEnd);

  // AJUSTE 3: Saldo usa apenas ganhos recebidos e gastos pagos
  const monthlyEarningsReceived = calcTotalEarningsReceived(earnings, monthStart, monthEnd);
  const paidExpenses = financials
    .filter((e) => e.type === "expense" && e.isPaid && isInRange(e.date, monthStart, monthEnd))
    .reduce((s, e) => s + e.value, 0);
  // AJUSTE 3: Corrigir bug - somar receitas lançadas no financeiro (income) ao saldo
  const financialIncome = financials
    .filter((e) => e.type === "income" && e.isPaid && isInRange(e.date, monthStart, monthEnd))
    .reduce((s, e) => s + e.value, 0);
  const totalMonthlyExpenses = paidExpenses;
  const totalBalance = monthlyEarningsReceived + extraTotal + financialIncome - totalMonthlyExpenses;

  // Meta diária baseada nas contas da semana
  const workDays = config.workDaysPerWeek || 5;
  const weekBillsCurrentUnpaid = getWeekBills(financials).filter((e) => !e.isPaid);
  const totalWeekBills = weekBillsCurrentUnpaid.reduce((s, e) => s + e.value, 0);
  const dailyGoal = workDays > 0 ? totalWeekBills / workDays : 0;

  // Contas da semana navegável
  const weekBillsRef = getWeekBills(financials, weekRef);
  const weekBillsUnpaid = weekBillsRef.filter((e) => !e.isPaid);
  const weekBillsPaid = weekBillsRef.filter((e) => e.isPaid);
  const weekBillsTotal = weekBillsRef.reduce((s, e) => s + e.value, 0);

  // Gráfico mensal
  const monthlyData = getMonthlyDailyData(earnings, extraIncomes, financials, monthRef);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Visão Geral</Text>

        {/* Meta Diária */}
        {totalWeekBills > 0 && (
          <View className="mb-4 bg-surface border border-warning/30 rounded-2xl p-4">
            <View className="flex-row items-center mb-1">
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
              <Text className="text-sm font-semibold text-foreground ml-2">Meta Diária</Text>
            </View>
            <Text className="text-xs text-muted">
              Você tem {formatCurrency(totalWeekBills)} em contas essa semana.
            </Text>
            <Text className="text-xs text-muted">
              Se trabalhar {workDays} dias, precisa fazer {formatCurrency(dailyGoal)} por dia.
            </Text>
            <Text className="text-lg font-bold text-foreground mt-1">
              {formatCurrency(dailyGoal)}/dia
            </Text>
          </View>
        )}

        {/* Stats Grid */}
        <View className="gap-3 mb-4">
          <View className="flex-row gap-3">
            <StatCard title="Saldo" value={formatCurrency(totalBalance)}
              icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={totalBalance >= 0 ? colors.success : colors.error} />} />
            <StatCard title="Ganhos Mês" value={formatCurrency(monthlyEarnings)}
              icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={colors.success} />} />
          </View>
          <View className="flex-row gap-3">
            <StatCard title="Ganhos Semana" value={formatCurrency(weeklyEarnings)}
              icon={<IconSymbol name="calendar" size={16} color={colors.primary} />} />
            <StatCard title="Renda Extra" value={formatCurrency(extraTotal)}
              icon={<IconSymbol name="plus.circle.fill" size={16} color={colors.success} />} />
          </View>
          <View className="flex-row gap-3">
            <StatCard title="Gasto do Mês" value={formatCurrency(totalMonthlyExpenses)}
              icon={<IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.error} />} />
            <StatCard title="KM Rodado" value={`${totalKm.toFixed(0)} km`}
              icon={<IconSymbol name="speedometer" size={16} color={colors.muted} />} />
          </View>
          {monthlyPending > 0 && (
            <View className="flex-row gap-3">
              <StatCard title="Pendente Apps" value={formatCurrency(monthlyPending)}
                icon={<IconSymbol name="clock.fill" size={16} color={colors.warning} />} />
              <View className="flex-1" />
            </View>
          )}
        </View>

        {/* Contas da Semana */}
        <View className="bg-surface border border-border rounded-2xl p-4 mb-4">
          <Text className="text-sm font-semibold text-muted mb-2 uppercase tracking-wide">
            Contas da Semana
          </Text>
          <DateNavigator
            label={formatWeekRange(weekRef)}
            onPrev={() => setWeekRef(shiftWeek(weekRef, -1))}
            onNext={() => setWeekRef(shiftWeek(weekRef, 1))}
          />
          <View className="flex-row justify-between mb-2">
            <Text className="text-xs text-muted">Total da Semana:</Text>
            <Text className="text-sm font-bold" style={{ color: colors.error }}>{formatCurrency(weekBillsTotal)}</Text>
          </View>

          {weekBillsUnpaid.length > 0 && (
            <>
              <Text className="text-xs font-semibold mb-1" style={{ color: colors.warning }}>A Pagar:</Text>
              {weekBillsUnpaid.map((e) => (
                <View key={e.id} className="flex-row justify-between py-1.5 border-b border-border/50">
                  <Text className="text-xs text-foreground flex-1" numberOfLines={1}>{e.description || e.category}</Text>
                  <Text className="text-xs text-muted mx-2">{formatDate(e.dueDate || e.date)}</Text>
                  <Text className="text-xs font-bold" style={{ color: colors.error }}>{formatCurrency(e.value)}</Text>
                </View>
              ))}
            </>
          )}
          {weekBillsPaid.length > 0 && (
            <>
              <Text className="text-xs font-semibold mt-2 mb-1" style={{ color: colors.success }}>Pagas:</Text>
              {weekBillsPaid.map((e) => (
                <View key={e.id} className="flex-row justify-between py-1.5 border-b border-border/50">
                  <Text className="text-xs text-muted line-through flex-1" numberOfLines={1}>{e.description || e.category}</Text>
                  <Text className="text-xs text-muted mx-2">{formatDate(e.dueDate || e.date)}</Text>
                  <Text className="text-xs text-muted">{formatCurrency(e.value)}</Text>
                </View>
              ))}
            </>
          )}
          {weekBillsRef.length === 0 && (
            <Text className="text-xs text-muted text-center py-2">Nenhuma conta nesta semana</Text>
          )}
        </View>

        {/* Gráfico Ganhos vs Gastos */}
        <Card title="Ganhos vs Gastos (Mês)" className="mb-4">
          <SimpleBarChart
            labels={["Ganhos", "Gastos"]}
            data={[monthlyEarnings + extraTotal, totalMonthlyExpenses]}
            barColors={["#4ADE80", "#F87171"]}
            height={120} showValues showTotal
          />
        </Card>

        {/* Gráfico de Linhas - Ganhos do Mês */}
        <Card title="Ganhos do Mês" className="mb-4">
          <DateNavigator
            label={formatMonthRange(monthRef)}
            onPrev={() => setMonthRef(shiftMonth(monthRef, -1))}
            onNext={() => setMonthRef(shiftMonth(monthRef, 1))}
          />
          <SimpleLineChart
            labels={monthlyData.labels}
            datasets={[
              { data: monthlyData.motoData, color: "#4ADE80", label: "Moto" },
              { data: monthlyData.extraData, color: "#FBBF24", label: "Renda Extra" },
              { data: monthlyData.gastoData, color: "#F87171", label: "Gastos" },
            ]}
            height={160} width={340} showTotal
          />
        </Card>
      </View>
    </ScrollView>
  );
}

// ==================== LANÇAMENTO ====================
// AJUSTE 4: Gerenciamento de categorias (criar/excluir)
function LancamentoTab() {
  const { financials, addFinancial, addMaintenance, addWalletTransaction, config, saveConfig } = useData();
  const colors = useColors();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("Combustível");
  // AJUSTE 3: Removido campo 'date' separado - usar apenas 'dueDate' (Vencimento)
  const [dueDate, setDueDate] = useState(todayFormatted());
  // AJUSTE 3: Switch "Já Pago?" no momento do lançamento
  const [isPaidNow, setIsPaidNow] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [fixedPeriod, setFixedPeriod] = useState<"weekly" | "monthly">("monthly");
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState("2");
  const [installmentPeriod, setInstallmentPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  // AJUSTE v7.1: Flexibilidade no lançamento parcelado
  const [installmentMode, setInstallmentMode] = useState<"per_installment" | "total_divided">("total_divided");
  // AJUSTE 4: Estado para gerenciamento de categorias
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const categories = config.expenseCategories || [
    "Combustível", "Alimentação", "Manutenção Moto", "Aluguel",
    "Internet", "Celular", "Lazer", "Saúde", "Outros",
  ];

  // AJUSTE 4: Adicionar nova categoria
  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    const trimmed = newCategory.trim();
    if (categories.includes(trimmed)) {
      if (Platform.OS === "web") alert("Categoria já existe");
      else Alert.alert("Aviso", "Categoria já existe");
      return;
    }
    const updated = [...categories, trimmed];
    await saveConfig({ expenseCategories: updated });
    setNewCategory("");
    if (Platform.OS === "web") alert(`Categoria "${trimmed}" criada!`);
    else Alert.alert("Sucesso", `Categoria "${trimmed}" criada!`);
  };

  // AJUSTE 4: Remover categoria
  const handleRemoveCategory = async (cat: string) => {
    const doRemove = async () => {
      const updated = categories.filter((c) => c !== cat);
      await saveConfig({ expenseCategories: updated });
      if (category === cat) setCategory(updated[0] || "Outros");
    };
    if (Platform.OS === "web") {
      if (confirm(`Remover categoria "${cat}"?`)) await doRemove();
    } else {
      Alert.alert("Confirmar", `Remover categoria "${cat}"?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: doRemove },
      ]);
    }
  };

  const handleSave = async () => {
    if (!description || !value) {
      if (Platform.OS === "web") alert("Preencha descrição e valor");
      else Alert.alert("Atenção", "Preencha descrição e valor");
      return;
    }

    const parsedValue = parseFloat(value.replace(",", "."));
    // AJUSTE 3: Usar dueDate como data principal (removido campo 'date' separado)
    const parsedDueDate = parseDateInput(dueDate);
    const parsedDate = parsedDueDate; // date = dueDate

    if (isInstallment && !isFixed) {
      const count = parseInt(installmentCount) || 2;
      // AJUSTE v7.1: Flexibilidade - valor por parcela ou valor total dividido
      const installmentValue = installmentMode === "per_installment" ? parsedValue : parsedValue / count;
      const totalValue = installmentMode === "per_installment" ? parsedValue * count : parsedValue;

      for (let i = 0; i < count; i++) {
        let installmentDueDate = new Date(parsedDueDate + "T12:00:00");
        if (installmentPeriod === "daily") {
          installmentDueDate.setDate(installmentDueDate.getDate() + i);
        } else if (installmentPeriod === "weekly") {
          installmentDueDate.setDate(installmentDueDate.getDate() + (i * 7));
        } else {
          installmentDueDate.setMonth(installmentDueDate.getMonth() + i);
        }

        await addFinancial({
          type,
          description: `${description} (${i + 1}/${count})`,
          value: installmentValue,
          category,
          date: parsedDate,
          dueDate: installmentDueDate.toISOString().split("T")[0],
          isPaid: false,
          isFixed: false,
          isInstallment: true,
          installmentCurrent: i + 1,
          totalInstallments: count,
        });
      }
    } else {
      await addFinancial({
        type,
        description,
        value: parsedValue,
        category,
        date: parsedDate,
        dueDate: parsedDueDate,
        isPaid: isPaidNow, // AJUSTE 3: Respeitar switch "Já Pago?"
        isFixed,
        fixedPeriod: isFixed ? fixedPeriod : undefined,
        isInstallment: false,
      });
    }

    // AJUSTE 3: Se categoria é Combustível, registrar também na Manutenção e debitar da Carteira Moto
    // Usamos MaintenanceDB.add() diretamente (sem addMaintenance) para evitar duplicação
    // no financeiro, já que addMaintenance também lança no financeiro via data-context.
    if (type === "expense" && category === "Combustível" && !isInstallment) {
      await MaintenanceDB.add({
        item: "Combustível",
        km: 0,
        value: parsedValue,
        location: description || "Posto",
        date: parsedDate,
      });
      // Debitar da Carteira Moto
      const motoWallet = (config.wallets || []).find((w) => w.name === "Moto" || w.id === "wallet_moto");
      if (motoWallet) {
        await addWalletTransaction({
          walletId: motoWallet.id,
          type: "withdrawal",
          value: parsedValue,
          description: `Combustível: ${description || "Abastecimento"}`,
          date: parsedDate,
        });
      }
    }

    setDescription(""); setValue(""); setIsPaidNow(false);
    if (Platform.OS === "web") alert("Lançamento salvo!");
    else Alert.alert("Sucesso", "Lançamento salvo!");
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Novo Lançamento</Text>

        {/* Tipo: Gasto ou Receita */}
        <View className="flex-row gap-2 mb-3">
          {(["expense", "income"] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setType(t)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: type === t ? (t === "expense" ? colors.error : colors.success) : colors.surface,
                borderWidth: 1, borderColor: type === t ? (t === "expense" ? colors.error : colors.success) : colors.border,
              }}>
              <Text style={{ color: type === t ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                {t === "expense" ? "Gasto" : "Receita"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Descrição */}
        <Text className="text-xs text-muted mb-1 uppercase">Descrição</Text>
        <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
          placeholder="Ex: Conta de luz" placeholderTextColor={colors.muted}
          value={description} onChangeText={setDescription} returnKeyType="done" />

        {/* Valor */}
        <Text className="text-xs text-muted mb-1 uppercase">Valor (R$)</Text>
        <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
          placeholder="0,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
          value={value} onChangeText={setValue} returnKeyType="done" />

        {/* Categoria */}
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-xs text-muted uppercase">Categoria</Text>
          <TouchableOpacity onPress={() => setShowCategoryManager(!showCategoryManager)}>
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
              {showCategoryManager ? "Fechar" : "Gerenciar"}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {categories.map((cat) => (
            <TouchableOpacity key={cat} onPress={() => setCategory(cat)}
              style={{
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 6,
                backgroundColor: category === cat ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: category === cat ? colors.primary : colors.border,
              }}>
              <Text style={{ color: category === cat ? "#fff" : colors.foreground, fontSize: 11, fontWeight: "600" }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* AJUSTE 4: Gerenciamento de Categorias */}
        {showCategoryManager && (
          <Card title="Gerenciar Categorias" className="mb-4">
            <Text className="text-xs text-muted mb-2">Adicione ou remova categorias personalizadas para seus lançamentos.</Text>

            {/* Lista de categorias existentes */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {categories.map((cat) => (
                <View key={cat} className="flex-row items-center bg-background border border-border rounded-xl px-3 py-2">
                  <Text className="text-xs text-foreground mr-2">{cat}</Text>
                  <TouchableOpacity onPress={() => handleRemoveCategory(cat)}>
                    <Text style={{ color: colors.error, fontSize: 14, fontWeight: "700" }}>x</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Adicionar nova categoria */}
            <View className="flex-row gap-2">
              <TextInput className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                placeholder="Nova categoria" placeholderTextColor={colors.muted}
                value={newCategory} onChangeText={setNewCategory} returnKeyType="done" />
              <TouchableOpacity onPress={handleAddCategory}
                style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>+ Criar</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* AJUSTE 3: Apenas campo Vencimento (removido campo Data redundante) */}
        <Text className="text-xs text-muted mb-1 uppercase">Vencimento</Text>
        <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
          placeholder="DD/MM/AA" placeholderTextColor={colors.muted}
          value={dueDate} onChangeText={setDueDate} returnKeyType="done" />

        {/* Conta Fixa */}
        <Card title="Opções" className="mb-4">
          {/* AJUSTE 3: Switch "Já Pago?" */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-foreground">Já Pago?</Text>
            <Switch value={isPaidNow} onValueChange={setIsPaidNow}
              trackColor={{ true: colors.success, false: colors.border }} />
          </View>

          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-foreground">Conta Fixa (Recorrente)</Text>
            <Switch value={isFixed} onValueChange={(v) => { setIsFixed(v); if (v) setIsInstallment(false); }}
              trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
          {isFixed && (
            <View className="flex-row gap-2 mb-3">
              {(["weekly", "monthly"] as const).map((p) => (
                <TouchableOpacity key={p} onPress={() => setFixedPeriod(p)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                    backgroundColor: fixedPeriod === p ? colors.primary : colors.surface,
                    borderWidth: 1, borderColor: fixedPeriod === p ? colors.primary : colors.border,
                  }}>
                  <Text style={{ color: fixedPeriod === p ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                    {p === "weekly" ? "Semanal" : "Mensal"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Parcelamento */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm text-foreground">Parcelado</Text>
            <Switch value={isInstallment} onValueChange={(v) => { setIsInstallment(v); if (v) setIsFixed(false); }}
              trackColor={{ true: colors.primary, false: colors.border }} />
          </View>
          {isInstallment && (
            <>
              {/* AJUSTE v7.1: Modo de parcelamento */}
              <Text className="text-xs text-muted mb-1 uppercase">Modo de Cálculo</Text>
              <View className="flex-row gap-2 mb-3">
                {(["total_divided", "per_installment"] as const).map((m) => (
                  <TouchableOpacity key={m} onPress={() => setInstallmentMode(m)}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                      backgroundColor: installmentMode === m ? colors.primary : colors.surface,
                      borderWidth: 1, borderColor: installmentMode === m ? colors.primary : colors.border,
                    }}>
                    <Text style={{ color: installmentMode === m ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 10 }}>
                      {m === "total_divided" ? "Total Dividido" : "Valor por Parcela"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-xs text-muted mb-2" style={{ fontStyle: "italic" }}>
                {installmentMode === "total_divided"
                  ? `O valor informado será dividido pelas parcelas.`
                  : `O valor informado é o custo de cada parcela.`}
              </Text>

              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1 uppercase">Parcelas</Text>
                  <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                    keyboardType="number-pad" value={installmentCount} onChangeText={setInstallmentCount} returnKeyType="done" />
                </View>
              </View>
              <Text className="text-xs text-muted mb-1 uppercase">Período das Parcelas</Text>
              <View className="flex-row gap-2 mb-3">
                {(["daily", "weekly", "monthly"] as const).map((p) => (
                  <TouchableOpacity key={p} onPress={() => setInstallmentPeriod(p)}
                    style={{
                      flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                      backgroundColor: installmentPeriod === p ? colors.primary : colors.surface,
                      borderWidth: 1, borderColor: installmentPeriod === p ? colors.primary : colors.border,
                    }}>
                    <Text style={{ color: installmentPeriod === p ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 11 }}>
                      {p === "daily" ? "Diário" : p === "weekly" ? "Semanal" : "Mensal"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </Card>

        <TouchableOpacity onPress={handleSave}
          style={{ backgroundColor: type === "expense" ? colors.error : colors.success, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            {type === "expense" ? "Lançar Gasto" : "Lançar Receita"}
          </Text>
        </TouchableOpacity>

        <Text className="text-sm font-semibold text-muted mt-5 mb-2 uppercase">Últimos Lançamentos</Text>
        {[...financials].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map((f) => (
          <View key={f.id} className="flex-row items-center bg-surface border border-border rounded-xl p-3 mb-2">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{f.description}</Text>
              <Text className="text-xs text-muted">
                {formatDate(f.date)} • {f.category}
                {f.isFixed ? " • Fixo" : ""}
                {f.isInstallment ? ` • ${f.installmentCurrent || ""}/${f.totalInstallments || f.installmentTotal || ""}` : ""}
              </Text>
            </View>
            <Text className="text-sm font-bold" style={{ color: f.type === "expense" ? colors.error : colors.success }}>
              {f.type === "expense" ? "-" : "+"}{formatCurrency(f.value)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ==================== CONTAS MENSAIS ====================
function ContasMensaisTab() {
  const { financials, addFinancial, updateFinancial, removeFinancial, removeFinancialInstallmentGroup, removeFinancialInstallmentFuture, addWalletTransaction, config } = useData();
  const colors = useColors();
  const [refDate, setRefDate] = useState(new Date());

  const monthStart = getStartOfMonth(refDate);
  const monthEnd = getEndOfMonth(refDate);

  const monthBills = financials.filter((f) => {
    const due = new Date(f.dueDate || f.date);
    return due >= monthStart && due <= monthEnd && f.type === "expense";
  }).sort((a, b) => new Date(a.dueDate || a.date).getTime() - new Date(b.dueDate || b.date).getTime());

  const totalMonth = monthBills.reduce((s, e) => s + e.value, 0);
  const totalPaid = monthBills.filter((e) => e.isPaid).reduce((s, e) => s + e.value, 0);
  const totalUnpaid = totalMonth - totalPaid;
  const countBills = monthBills.length;
  const countPaid = monthBills.filter((e) => e.isPaid).length;

  // AJUSTE 3 cont: Soma de Contas Fixas do mês
  const fixedBillsTotal = monthBills.filter((f) => f.isFixed).reduce((s, e) => s + e.value, 0);

  // AJUSTE 3 cont: Divisão por Dias Trabalhados
  const workDaysMonth = config.workDaysPerWeek || 5;
  // Estimar dias trabalhados no mês: dias/semana * 4.33
  const workDaysInMonth = Math.round(workDaysMonth * 4.33);
  const fixedPerWorkDay = workDaysInMonth > 0 ? fixedBillsTotal / workDaysInMonth : 0;

  // AJUSTE 4: Meta Diária de Contas (adaptativa)
  const today = new Date();
  const isCurrentMonth = today.getMonth() === refDate.getMonth() && today.getFullYear() === refDate.getFullYear();
  const daysLeftInMonth = isCurrentMonth
    ? Math.max(1, monthEnd.getDate() - today.getDate())
    : monthEnd.getDate();
  const workDaysRemaining = isCurrentMonth
    ? Math.max(1, Math.round((daysLeftInMonth / 7) * workDaysMonth))
    : workDaysInMonth;
  // AJUSTE 4: Incluir previsões de KM e alimentação no montante mensal
  const estKmWeekly = config.estimatedWeeklyKmCost || 0;
  const estFoodWeekly = config.estimatedWeeklyFoodCost || 0;
  const estKmMonthly = estKmWeekly * 4.33;
  const estFoodMonthly = estFoodWeekly * 4.33;
  const totalContasComPrevisao = totalUnpaid + estKmMonthly + estFoodMonthly;
  const metaDiaria = workDaysRemaining > 0 ? totalContasComPrevisao / workDaysRemaining : 0;

  // AJUSTE 3 v6: Estado para edição pré-baixa
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // AJUSTE 3 v6: Ao dar baixa, permitir editar valor antes e debitar da Carteira Moto
  const handleTogglePaid = async (id: string, currentPaid: boolean) => {
    if (!currentPaid) {
      // Dar baixa - abrir edição pré-baixa
      const bill = financials.find((f) => f.id === id);
      if (bill) {
        setEditingBillId(id);
        setEditValue(bill.value.toString().replace(".", ","));
      }
    } else {
      // Desfazer baixa
      await updateFinancial(id, { isPaid: false });
    }
  };

  // AJUSTE 3 v6: Confirmar baixa com valor editado + debitar Carteira Moto
  const handleConfirmBaixa = async () => {
    if (!editingBillId) return;
    const bill = financials.find((f) => f.id === editingBillId);
    if (!bill) return;
    const newValue = parseFloat(editValue.replace(",", ".")) || bill.value;
    await updateFinancial(editingBillId, { isPaid: true, value: newValue });
    // AJUSTE 3 v6: Debitar da Carteira Moto somente na baixa efetiva
    if (bill.category === "Combustível" || bill.description.includes("Custo KM")) {
      const motoWallet = (config.wallets || []).find((w: any) => w.name === "Moto" || w.id === "wallet_moto");
      if (motoWallet) {
        await addWalletTransaction({
          walletId: motoWallet.id,
          type: "withdrawal",
          value: newValue,
          description: `Baixa: ${bill.description}`,
          date: new Date().toISOString().split("T")[0],
        });
      }
    }
    setEditingBillId(null);
    setEditValue("");
    if (Platform.OS === "web") alert(`Baixa de ${formatCurrency(newValue)} realizada!`);
    else Alert.alert("Sucesso", `Baixa de ${formatCurrency(newValue)} realizada!`);
  };

  // AJUSTE 1 v6: Exclusão de parcelas com 3 opções
  const handleDeleteBill = (bill: typeof financials[0]) => {
    if (!bill.isInstallment) {
      // Conta normal (não parcelada) - excluir diretamente
      const doDelete = () => removeFinancial(bill.id);
      if (Platform.OS === "web") {
        if (confirm(`Excluir "${bill.description}"?`)) doDelete();
      } else {
        Alert.alert("Confirmar", `Excluir "${bill.description}"?`, [
          { text: "Cancelar", style: "cancel" },
          { text: "Excluir", style: "destructive", onPress: doDelete },
        ]);
      }
      return;
    }
    // Conta parcelada - oferecer 3 opções
    if (Platform.OS === "web") {
      const choice = prompt(
        `Excluir parcela "${bill.description}"\n\n` +
        `Escolha uma opção:\n` +
        `1 - Excluir apenas esta parcela\n` +
        `2 - Excluir todas as parcelas (passadas e futuras)\n` +
        `3 - Excluir esta e as parcelas futuras\n\n` +
        `Digite 1, 2 ou 3:`,
        "1"
      );
      if (choice === "1") removeFinancial(bill.id);
      else if (choice === "2") removeFinancialInstallmentGroup(bill.id);
      else if (choice === "3") removeFinancialInstallmentFuture(bill.id);
    } else {
      Alert.alert(
        "Excluir Parcela",
        `Como deseja excluir "${bill.description}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Apenas esta parcela", onPress: () => removeFinancial(bill.id) },
          { text: "Todas as parcelas", style: "destructive", onPress: () => removeFinancialInstallmentGroup(bill.id) },
          { text: "Esta e futuras", onPress: () => removeFinancialInstallmentFuture(bill.id) },
        ]
      );
    }
  };

  const handleDuplicateFixed = async () => {
    const fixedBills = monthBills.filter((f) => f.isFixed);
    if (fixedBills.length === 0) {
      if (Platform.OS === "web") alert("Nenhuma conta fixa neste mês");
      else Alert.alert("Aviso", "Nenhuma conta fixa neste mês");
      return;
    }

    const nextMonthStart = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);

    for (const bill of fixedBills) {
      const originalDue = new Date(bill.dueDate || bill.date);
      const newDue = new Date(nextMonthStart.getFullYear(), nextMonthStart.getMonth(), originalDue.getDate());

      const exists = financials.some((f) =>
        f.description === bill.description &&
        f.isFixed &&
        new Date(f.dueDate || f.date).getMonth() === newDue.getMonth() &&
        new Date(f.dueDate || f.date).getFullYear() === newDue.getFullYear()
      );
      if (exists) continue;

      await addFinancial({
        type: bill.type,
        description: bill.description,
        value: bill.value,
        category: bill.category,
        date: newDue.toISOString().split("T")[0],
        dueDate: newDue.toISOString().split("T")[0],
        isPaid: false,
        isFixed: true,
        fixedPeriod: bill.fixedPeriod,
        isInstallment: false,
      });
    }

    if (Platform.OS === "web") alert(`${fixedBills.length} conta(s) fixa(s) duplicadas para o próximo mês!`);
    else Alert.alert("Sucesso", `${fixedBills.length} conta(s) fixa(s) duplicadas para o próximo mês!`);
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Contas Mensais</Text>

        <DateNavigator
          label={formatMonthRange(refDate)}
          onPrev={() => setRefDate(shiftMonth(refDate, -1))}
          onNext={() => setRefDate(shiftMonth(refDate, 1))}
        />

        <View className="flex-row gap-3 mb-3">
          <StatCard title="Total do Mês" value={formatCurrency(totalMonth)}
            icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={colors.error} />} />
          <StatCard title="A Vencer" value={formatCurrency(totalUnpaid)}
            icon={<IconSymbol name="clock.fill" size={16} color={colors.warning} />} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Pago" value={formatCurrency(totalPaid)}
            icon={<IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />} />
          <StatCard title="Contas" value={`${countPaid}/${countBills}`}
            icon={<IconSymbol name="list.bullet" size={16} color={colors.muted} />} />
        </View>

        {/* AJUSTE 3 cont: Cards de Soma de Contas Fixas e Divisão por Dias Trabalhados */}
        <View className="flex-row gap-3 mb-4">
          <StatCard title="Contas Fixas" value={formatCurrency(fixedBillsTotal)}
            icon={<IconSymbol name="pin.fill" size={16} color={colors.primary} />} />
          <StatCard title="Fixas/Dia Trab." value={formatCurrency(fixedPerWorkDay)}
            icon={<IconSymbol name="calendar.badge.clock" size={16} color={colors.warning} />} />
        </View>
        {fixedBillsTotal > 0 && (
          <View className="bg-surface border border-border rounded-xl p-3 mb-4">
            <Text className="text-xs text-muted">
              Suas contas fixas somam {formatCurrency(fixedBillsTotal)} no mês.
              Trabalhando {workDaysMonth} dias/semana (~{workDaysInMonth} dias/mês),
              você precisa faturar pelo menos {formatCurrency(fixedPerWorkDay)}/dia só para cobrir as fixas.
            </Text>
          </View>
        )}

        {/* AJUSTE 1: Botão "Duplicar Fixas" REMOVIDO - agora é automático via data-context */}

        {/* AJUSTE 4: Card Meta Diária de Contas */}
        <Card title="Meta Diária de Contas" className="mb-4">
          <View className="flex-row gap-3 mb-2">
            <StatCard title="Meta/Dia" value={formatCurrency(metaDiaria)}
              icon={<IconSymbol name="target" size={16} color={colors.primary} />} />
            <StatCard title="Dias Trab. Rest." value={workDaysRemaining.toString()}
              icon={<IconSymbol name="calendar" size={16} color={colors.warning} />} />
          </View>
          <View className="bg-background border border-border rounded-xl p-3">
            <Text className="text-xs text-muted">
              Contas a vencer: {formatCurrency(totalUnpaid)}
              {(estKmMonthly > 0 || estFoodMonthly > 0) ? (
                ` + Previsão KM: ${formatCurrency(estKmMonthly)} + Alimentação: ${formatCurrency(estFoodMonthly)}`
              ) : ""}
            </Text>
            <Text className="text-xs font-bold mt-1" style={{ color: colors.primary }}>
              Total a cobrir: {formatCurrency(totalContasComPrevisao)} ÷ {workDaysRemaining} dias = {formatCurrency(metaDiaria)}/dia
            </Text>
          </View>
        </Card>

        {/* AJUSTE 3 v6: Modal de Edição Pré-Baixa */}
        {editingBillId && (
          <View className="bg-surface border-2 rounded-2xl p-4 mb-4" style={{ borderColor: colors.primary }}>
            <Text className="text-sm font-bold text-foreground mb-2">Confirmar Baixa</Text>
            <Text className="text-xs text-muted mb-2">
              Você pode editar o valor antes de confirmar a baixa.
              {financials.find((f) => f.id === editingBillId)?.category === "Combustível" ||
               financials.find((f) => f.id === editingBillId)?.description.includes("Custo KM")
                ? " O valor será debitado da Carteira Moto."
                : ""}
            </Text>
            <Text className="text-xs text-muted mb-1 uppercase">Descrição</Text>
            <Text className="text-sm font-semibold text-foreground mb-2">
              {financials.find((f) => f.id === editingBillId)?.description || ""}
            </Text>
            <Text className="text-xs text-muted mb-1 uppercase">Valor (R$)</Text>
            <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
              keyboardType="decimal-pad" value={editValue} onChangeText={setEditValue} returnKeyType="done" />
            <View className="flex-row gap-2">
              <TouchableOpacity onPress={() => { setEditingBillId(null); setEditValue(""); }}
                style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmBaixa}
                style={{ flex: 1, backgroundColor: colors.success, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Confirmar Baixa</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {monthBills.length === 0 && (
          <Text className="text-sm text-muted text-center py-4">Nenhuma conta neste mês</Text>
        )}
        {monthBills.map((bill) => (
          <View key={bill.id} className="bg-surface border border-border rounded-xl p-3 mb-2">
            <View className="flex-row items-center">
              <TouchableOpacity onPress={() => handleTogglePaid(bill.id, bill.isPaid)}
                style={{
                  width: 24, height: 24, borderRadius: 12, marginRight: 10,
                  backgroundColor: bill.isPaid ? colors.success : "transparent",
                  borderWidth: 2, borderColor: bill.isPaid ? colors.success : colors.border,
                  alignItems: "center", justifyContent: "center",
                }}>
                {bill.isPaid && <IconSymbol name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
              <View className="flex-1">
                <Text className={`text-sm font-semibold ${bill.isPaid ? "line-through text-muted" : "text-foreground"}`}>
                  {bill.description}
                </Text>
                <Text className="text-xs text-muted">
                  {formatDate(bill.dueDate || bill.date)} • {bill.category}
                  {bill.isFixed ? " • Fixo" : ""}
                  {bill.isInstallment ? ` • ${bill.installmentCurrent || ""}/${bill.totalInstallments || bill.installmentTotal || ""}` : ""}
                </Text>
              </View>
              <Text className="text-sm font-bold mr-2" style={{ color: bill.isPaid ? colors.muted : colors.error }}>
                {formatCurrency(bill.value)}
              </Text>
              <TouchableOpacity onPress={() => handleDeleteBill(bill)} style={{ padding: 4 }}>
                <IconSymbol name="trash.fill" size={14} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ==================== GRÁFICOS ====================
// AJUSTE 4: Novo submenu com gráficos anuais de gastos por categoria e ganhos consolidados
function GraficosTab() {
  const { financials, earnings, extraIncomes, config } = useData();
  const colors = useColors();
  const [yearRef, setYearRef] = useState(new Date());

  const year = yearRef.getFullYear();
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // AJUSTE 4: Gráfico de linha anual de gastos por categoria (mensal)
  const categories = config.expenseCategories || [];
  const categoryMonthlyData = useMemo(() => {
    const yearExpenses = financials.filter((f) => {
      if (f.type !== "expense") return false;
      const d = new Date(f.date + "T12:00:00");
      return d.getFullYear() === year;
    });

    // Pegar as top 6 categorias com mais gastos
    const catTotals: Record<string, number> = {};
    yearExpenses.forEach((f) => {
      catTotals[f.category] = (catTotals[f.category] || 0) + f.value;
    });
    const topCats = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cat]) => cat);

    const LINE_COLORS = ["#F87171", "#FBBF24", "#4ADE80", "#60A5FA", "#A78BFA", "#FB923C"];

    const datasets = topCats.map((cat, idx) => {
      const data = new Array(12).fill(0);
      yearExpenses.filter((f) => f.category === cat).forEach((f) => {
        const d = new Date(f.date + "T12:00:00");
        data[d.getMonth()] += f.value;
      });
      return { data, color: LINE_COLORS[idx % LINE_COLORS.length], label: cat };
    });

    return { labels: monthNames, datasets };
  }, [financials, year]);

  // AJUSTE 4: Gráfico de ganhos consolidando apps + renda extra
  const earningsChartData = useMemo(() => {
    const yearEarnings = earnings.filter((e) => {
      const d = new Date(e.date + "T12:00:00");
      return d.getFullYear() === year;
    });
    const yearExtra = extraIncomes.filter((e) => {
      const d = new Date(e.date + "T12:00:00");
      return d.getFullYear() === year;
    });

    // Dados por app (mensal)
    const apps = [...new Set(yearEarnings.map((e) => e.appName))];
    const APP_LINE_COLORS = ["#EA1D2C", "#FFCC00", "#06C167", "#FF6B00", "#00B0FF", "#2ECC40"];

    const datasets: { data: number[]; color: string; label: string }[] = [];

    apps.forEach((app, idx) => {
      const data = new Array(12).fill(0);
      yearEarnings.filter((e) => e.appName === app).forEach((e) => {
        const d = new Date(e.date + "T12:00:00");
        data[d.getMonth()] += e.value;
      });
      datasets.push({ data, color: getAppColor(app) || APP_LINE_COLORS[idx % APP_LINE_COLORS.length], label: app });
    });

    // Renda Extra como uma linha separada
    if (yearExtra.length > 0) {
      const extraData = new Array(12).fill(0);
      yearExtra.forEach((e) => {
        const d = new Date(e.date + "T12:00:00");
        extraData[d.getMonth()] += e.value;
      });
      datasets.push({ data: extraData, color: "#FBBF24", label: "Renda Extra" });
    }

    return { labels: monthNames, datasets };
  }, [earnings, extraIncomes, year]);

  // Totais anuais
  const totalGanhosAnual = useMemo(() => {
    const yearEarnings = earnings.filter((e) => new Date(e.date + "T12:00:00").getFullYear() === year);
    const yearExtra = extraIncomes.filter((e) => new Date(e.date + "T12:00:00").getFullYear() === year);
    return yearEarnings.reduce((s, e) => s + e.value, 0) + yearExtra.reduce((s, e) => s + e.value, 0);
  }, [earnings, extraIncomes, year]);

  const totalGastosAnual = useMemo(() => {
    return financials
      .filter((f) => f.type === "expense" && new Date(f.date + "T12:00:00").getFullYear() === year)
      .reduce((s, f) => s + f.value, 0);
  }, [financials, year]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Gráficos Anuais</Text>

        <DateNavigator
          label={formatYearRange(yearRef)}
          onPrev={() => setYearRef(shiftYear(yearRef, -1))}
          onNext={() => setYearRef(shiftYear(yearRef, 1))}
        />

        {/* Cards de resumo anual */}
        <View className="flex-row gap-3 mb-4">
          <StatCard title="Ganhos Anual" value={formatCurrency(totalGanhosAnual)}
            icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={colors.success} />} />
          <StatCard title="Gastos Anual" value={formatCurrency(totalGastosAnual)}
            icon={<IconSymbol name="exclamationmark.triangle.fill" size={16} color={colors.error} />} />
        </View>
        <View className="flex-row gap-3 mb-4">
          <StatCard title="Saldo Anual" value={formatCurrency(totalGanhosAnual - totalGastosAnual)}
            icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={(totalGanhosAnual - totalGastosAnual) >= 0 ? colors.success : colors.error} />} />
          <View className="flex-1" />
        </View>

        {/* AJUSTE 4: Gráfico de linha anual - Gastos por Categoria */}
        {categoryMonthlyData.datasets.length > 0 && (
          <Card title="Gastos por Categoria (Mensal)" className="mb-4">
            <SimpleLineChart
              labels={categoryMonthlyData.labels}
              datasets={categoryMonthlyData.datasets}
              height={200} width={340} showTotal
            />
          </Card>
        )}

        {/* AJUSTE 4: Gráfico de ganhos - Apps + Renda Extra */}
        {earningsChartData.datasets.length > 0 && (
          <Card title="Ganhos por App + Renda Extra (Mensal)" className="mb-4">
            <SimpleLineChart
              labels={earningsChartData.labels}
              datasets={earningsChartData.datasets}
              height={200} width={340} showTotal
            />
          </Card>
        )}

        {/* Gráfico de barras comparativo mensal */}
        <Card title="Ganhos vs Gastos (Mensal)" className="mb-4">
          {(() => {
            const ganhosData = new Array(12).fill(0);
            const gastosData = new Array(12).fill(0);
            earnings.filter((e) => new Date(e.date + "T12:00:00").getFullYear() === year).forEach((e) => {
              ganhosData[new Date(e.date + "T12:00:00").getMonth()] += e.value;
            });
            extraIncomes.filter((e) => new Date(e.date + "T12:00:00").getFullYear() === year).forEach((e) => {
              ganhosData[new Date(e.date + "T12:00:00").getMonth()] += e.value;
            });
            financials.filter((f) => f.type === "expense" && new Date(f.date + "T12:00:00").getFullYear() === year).forEach((f) => {
              gastosData[new Date(f.date + "T12:00:00").getMonth()] += f.value;
            });
            return (
              <SimpleBarChart
                labels={monthNames}
                data={ganhosData}
                secondaryData={gastosData}
                color="#4ADE80"
                secondaryColor="#F87171"
                height={180} showValues showTotal
              />
            );
          })()}
        </Card>
      </View>
    </ScrollView>
  );
}

// ==================== RELATÓRIO ====================
function RelatorioTab() {
  const { financials, earnings, extraIncomes } = useData();
  const colors = useColors();
  const [refDate, setRefDate] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");

  const monthStart = getStartOfMonth(refDate);
  const monthEnd = getEndOfMonth(refDate);

  const monthFinancials = financials.filter((f) => isInRange(f.date, monthStart, monthEnd));
  const monthEarnings = earnings.filter((e) => isInRange(e.date, monthStart, monthEnd));
  const monthExtra = extraIncomes.filter((e) => isInRange(e.date, monthStart, monthEnd));

  const totalGanhos = monthEarnings.reduce((s, e) => s + e.value, 0) + monthExtra.reduce((s, e) => s + e.value, 0);
  const totalGastos = monthFinancials.filter((f) => f.type === "expense").reduce((s, f) => s + f.value, 0);
  const saldo = totalGanhos - totalGastos;

  const allTransactions = useMemo(() => {
    const items: { id: string; date: string; description: string; value: number; type: "income" | "expense"; category?: string }[] = [];

    monthEarnings.forEach((e) => {
      items.push({ id: `e_${e.id}`, date: e.date, description: `${e.appName}`, value: e.value, type: "income", category: "Apps" });
    });

    monthExtra.forEach((e) => {
      items.push({ id: `x_${e.id}`, date: e.date, description: e.name, value: e.value, type: "income", category: "Renda Extra" });
    });

    monthFinancials.forEach((f) => {
      items.push({ id: `f_${f.id}`, date: f.date, description: f.description, value: f.value, type: f.type as any, category: f.category });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [monthEarnings, monthExtra, monthFinancials]);

  const filteredTransactions = filter === "all" ? allTransactions
    : allTransactions.filter((t) => t.type === filter);

  const daysInMonth = monthEnd.getDate();
  const labels: string[] = [];
  const ganhosCum: number[] = [];
  const gastosCum: number[] = [];
  let cumGanhos = 0;
  let cumGastos = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    labels.push(String(d));
    const dayStr = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    cumGanhos += monthEarnings.filter((e) => e.date === dayStr).reduce((s, e) => s + e.value, 0);
    cumGanhos += monthExtra.filter((e) => e.date === dayStr).reduce((s, e) => s + e.value, 0);
    cumGastos += monthFinancials.filter((f) => f.type === "expense" && f.date === dayStr).reduce((s, f) => s + f.value, 0);

    ganhosCum.push(cumGanhos);
    gastosCum.push(cumGastos);
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Relatório</Text>

        <DateNavigator
          label={formatMonthRange(refDate)}
          onPrev={() => setRefDate(shiftMonth(refDate, -1))}
          onNext={() => setRefDate(shiftMonth(refDate, 1))}
        />

        {/* Filtros */}
        <View className="flex-row gap-2 mb-3">
          {(["all", "income", "expense"] as const).map((f) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: filter === f ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: filter === f ? colors.primary : colors.border,
              }}>
              <Text style={{ color: filter === f ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                {f === "all" ? "Todos" : f === "income" ? "Ganhos" : "Gastos"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="flex-row gap-3 mb-3">
          <StatCard title="Ganhos" value={formatCurrency(totalGanhos)}
            icon={<IconSymbol name="arrow.up.circle.fill" size={16} color={colors.success} />} />
          <StatCard title="Gastos" value={formatCurrency(totalGastos)}
            icon={<IconSymbol name="arrow.down.circle.fill" size={16} color={colors.error} />} />
        </View>
        <View className="flex-row gap-3 mb-4">
          <StatCard title="Saldo" value={formatCurrency(saldo)}
            icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={saldo >= 0 ? colors.success : colors.error} />} />
          <StatCard title="Transações" value={filteredTransactions.length.toString()}
            icon={<IconSymbol name="list.bullet" size={16} color={colors.muted} />} />
        </View>

        <Card title="Andamento do Mês" className="mb-4">
          <SimpleLineChart
            labels={labels}
            datasets={[
              { data: ganhosCum, color: "#4ADE80", label: "Ganhos" },
              { data: gastosCum, color: "#F87171", label: "Gastos" },
            ]}
            height={160} width={340} showTotal
          />
        </Card>

        <Text className="text-sm font-semibold text-muted mb-2 uppercase">Transações</Text>
        {filteredTransactions.map((t) => (
          <View key={t.id} className="flex-row items-center bg-surface border border-border rounded-xl p-3 mb-2">
            <View style={{
              width: 32, height: 32, borderRadius: 16, marginRight: 10,
              backgroundColor: t.type === "income" ? colors.success + "20" : colors.error + "20",
              alignItems: "center", justifyContent: "center",
            }}>
              <IconSymbol
                name={t.type === "income" ? "arrow.up.circle.fill" : "arrow.down.circle.fill"}
                size={18} color={t.type === "income" ? colors.success : colors.error}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{t.description}</Text>
              <Text className="text-xs text-muted">{formatDate(t.date)} • {t.category || ""}</Text>
            </View>
            <Text className="text-sm font-bold" style={{ color: t.type === "income" ? colors.success : colors.error }}>
              {t.type === "income" ? "+" : "-"}{formatCurrency(t.value)}
            </Text>
          </View>
        ))}
        {filteredTransactions.length === 0 && (
          <Text className="text-sm text-muted text-center py-4">Nenhuma transação no período</Text>
        )}
      </View>
    </ScrollView>
  );
}


// ==================== CONFIGURAÇÕES (AJUSTE 5) ====================
// 5.1: Limitador de Gastos por categoria
// 5.2: Previsão de Gasto Semanal e Mensal (Estimativa vs. Real)
function ConfiguracoesTab() {
  const { config, saveConfig, financials } = useData();
  const colors = useColors();

  // AJUSTE 1.2: Estado para Saldo Inicial
  const [initialBalanceInput, setInitialBalanceInput] = useState(
    (config.initialBalance || 0) > 0 ? (config.initialBalance || 0).toString().replace(".", ",") : ""
  );

  // ===== 5.1: Limitador de Gastos =====
  const [limitCategory, setLimitCategory] = useState(
    (config.expenseCategories || ["Combustível"])[0] || "Combustível"
  );
  const [limitValue, setLimitValue] = useState("");
  const [limitPeriod, setLimitPeriod] = useState<"week" | "month">("week");

  const spendingLimits = config.spendingLimits || [];

  // AJUSTE 1.2: Handler para salvar Saldo Inicial
  const handleSaveInitialBalance = async () => {
    const val = parseFloat(initialBalanceInput.replace(",", ".")) || 0;
    await saveConfig({ initialBalance: val });
    if (Platform.OS === "web") alert("Saldo inicial salvo!");
    else Alert.alert("Sucesso", "Saldo inicial salvo!");
  };

  const handleAddLimit = async () => {
    if (!limitValue) {
      if (Platform.OS === "web") alert("Preencha o valor do limite");
      else Alert.alert("Atenção", "Preencha o valor do limite");
      return;
    }
    const parsedValue = parseFloat(limitValue.replace(",", "."));
    // Verificar se já existe limite para essa categoria/período
    const existing = spendingLimits.findIndex(
      (l) => l.category === limitCategory && l.period === limitPeriod
    );
    let updated = [...spendingLimits];
    if (existing >= 0) {
      updated[existing] = { ...updated[existing], limit: parsedValue };
    } else {
      updated.push({ category: limitCategory, limit: parsedValue, period: limitPeriod });
    }
    await saveConfig({ spendingLimits: updated });
    setLimitValue("");
    if (Platform.OS === "web") alert("Limite salvo!");
    else Alert.alert("Sucesso", "Limite salvo!");
  };

  const handleRemoveLimit = async (index: number) => {
    const doRemove = async () => {
      const updated = spendingLimits.filter((_, i) => i !== index);
      await saveConfig({ spendingLimits: updated });
    };
    if (Platform.OS === "web") {
      if (confirm("Remover este limite?")) await doRemove();
    } else {
      Alert.alert("Confirmar", "Remover este limite?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: doRemove },
      ]);
    }
  };

  // AJUSTE 2 v6: Previsão de Gastos REMOVIDA conforme PDF

  const categories = config.expenseCategories || [
    "Combustível", "Alimentação", "Manutenção Moto", "Aluguel",
    "Internet", "Celular", "Lazer", "Saúde", "Outros",
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-4">Configurações Financeiro</Text>

        {/* ===== 1.2: SALDO INICIAL ===== */}
        <Card title="Saldo Inicial" className="mb-4">
          <Text className="text-xs text-muted mb-2">
            Defina um saldo inicial que será a base para todos os cálculos financeiros.
          </Text>
          <Text className="text-xs text-muted mb-1 uppercase">Valor do Saldo Inicial (R$)</Text>
          <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
            placeholder="Ex: 500,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
            value={initialBalanceInput} onChangeText={setInitialBalanceInput} returnKeyType="done" />
          <TouchableOpacity onPress={handleSaveInitialBalance}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Salvar Saldo Inicial</Text>
          </TouchableOpacity>
        </Card>

        {/* ===== 5.1: LIMITADOR DE GASTOS ===== */}
        <Card title="Limitador de Gastos" className="mb-4">
          <Text className="text-xs text-muted mb-3">
            Defina limites de gastos por categoria. Você receberá um aviso quando atingir 80% do limite,
            mas poderá continuar lançando gastos normalmente.
          </Text>

          {/* Limites existentes */}
          {spendingLimits.length > 0 && (
            <View className="mb-4">
              <Text className="text-xs font-semibold text-muted mb-2 uppercase">Limites Ativos</Text>
              {spendingLimits.map((lim, index) => {
                const spent = getCategorySpending(financials, lim.category, lim.period);
                const pct = lim.limit > 0 ? (spent / lim.limit) * 100 : 0;
                const isOver = pct >= 100;
                const isWarning = pct >= 80;

                return (
                  <View key={index} className="bg-background border rounded-xl p-3 mb-2"
                    style={{ borderColor: isOver ? colors.error : isWarning ? colors.warning : colors.border }}>
                    <View className="flex-row justify-between items-center mb-1">
                      <Text className="text-sm font-semibold text-foreground">{lim.category}</Text>
                      <TouchableOpacity onPress={() => handleRemoveLimit(index)}>
                        <IconSymbol name="trash.fill" size={14} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                    <Text className="text-xs text-muted mb-1">
                      {lim.period === "week" ? "Semanal" : "Mensal"} • Limite: {formatCurrency(lim.limit)}
                    </Text>
                    {/* Barra de progresso */}
                    <View className="bg-surface rounded-full h-3 mb-1 overflow-hidden">
                      <View style={{
                        width: `${Math.min(100, pct)}%`,
                        height: "100%",
                        backgroundColor: isOver ? colors.error : isWarning ? colors.warning : colors.success,
                        borderRadius: 999,
                      }} />
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-xs font-bold"
                        style={{ color: isOver ? colors.error : isWarning ? colors.warning : colors.success }}>
                        {formatCurrency(spent)} / {formatCurrency(lim.limit)}
                      </Text>
                      <Text className="text-xs text-muted">{pct.toFixed(0)}%</Text>
                    </View>
                    {isOver && (
                      <Text className="text-xs font-bold mt-1" style={{ color: colors.error }}>
                        LIMITE ULTRAPASSADO!
                      </Text>
                    )}
                    {isWarning && !isOver && (
                      <Text className="text-xs font-bold mt-1" style={{ color: colors.warning }}>
                        Atenção: próximo do limite!
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Adicionar novo limite */}
          <Text className="text-xs text-muted mb-1 uppercase">Categoria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {categories.map((cat) => (
              <TouchableOpacity key={cat} onPress={() => setLimitCategory(cat)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 6,
                  backgroundColor: limitCategory === cat ? colors.primary : colors.surface,
                  borderWidth: 1, borderColor: limitCategory === cat ? colors.primary : colors.border,
                }}>
                <Text style={{ color: limitCategory === cat ? "#fff" : colors.foreground, fontSize: 11, fontWeight: "600" }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text className="text-xs text-muted mb-1 uppercase">Período</Text>
          <View className="flex-row gap-2 mb-3">
            {(["week", "month"] as const).map((p) => (
              <TouchableOpacity key={p} onPress={() => setLimitPeriod(p)}
                style={{
                  flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                  backgroundColor: limitPeriod === p ? colors.primary : colors.surface,
                  borderWidth: 1, borderColor: limitPeriod === p ? colors.primary : colors.border,
                }}>
                <Text style={{ color: limitPeriod === p ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                  {p === "week" ? "Semanal" : "Mensal"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-xs text-muted mb-1 uppercase">Valor do Limite (R$)</Text>
          <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
            placeholder="Ex: 250,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
            value={limitValue} onChangeText={setLimitValue} returnKeyType="done" />

          <TouchableOpacity onPress={handleAddLimit}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Salvar Limite</Text>
          </TouchableOpacity>
        </Card>

        {/* AJUSTE 2 v6: Card "Previsão de Gastos" REMOVIDO conforme solicitado no PDF */}
      </View>
    </ScrollView>
  );
}
