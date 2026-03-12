import { useState } from "react";
import { ScrollView, Text, View, TouchableOpacity, Alert, Platform, Share, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Card, StatCard } from "@/components/ui/card";
import { SimpleBarChart, SimpleLineChart, DateNavigator } from "@/components/ui/simple-chart";
import { useData } from "@/lib/data-context";
import { useColors } from "@/hooks/use-colors";
import {
  calcTotalEarnings, calcTotalEarningsReceived, calcTotalEarningsPending,
  calcTotalKm, calcTotalExpenses, calcWeeklyGoal, calcTotalExtraIncome,
  calcMaintenanceCost, getCategorySpending, // getCategorySpending still used for limit alerts
  getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth,
  getMonthlyDailyData, getWeekBills,
  formatCurrency, formatDate, formatWeekRange, formatMonthRange,
  shiftMonth, shiftWeek, isInRange, todayFormatted,
} from "@/lib/calculations";
import { IconSymbol } from "@/components/ui/icon-symbol";

const APP_VERSION = "1.8.0";

export default function DashboardScreen() {
  const {
    earnings, dailyKms, maintenance, financials, extraIncomes, weeklyKmCosts, config, loading,
    exportData, importData, clearAllData,
  } = useData();
  const colors = useColors();
  const [monthRef, setMonthRef] = useState(new Date());
  const [weekRef, setWeekRef] = useState(new Date());
  const [showBackup, setShowBackup] = useState(false);
  const [importJson, setImportJson] = useState("");

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text className="text-muted text-lg">Carregando...</Text>
      </ScreenContainer>
    );
  }

  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const weekEnd = getEndOfWeek(now);
  const monthStart = getStartOfMonth(now);
  const monthEnd = getEndOfMonth(now);

  const weeklyEarnings = calcTotalEarnings(earnings, weekStart, weekEnd);
  const monthlyEarnings = calcTotalEarnings(earnings, monthStart, monthEnd);
  const totalKm = calcTotalKm(dailyKms, monthStart, monthEnd);

  // AJUSTE 3: Usar somente ganhos RECEBIDOS para o saldo (na data de pagamento)
  const monthlyEarningsReceived = calcTotalEarningsReceived(earnings, monthStart, monthEnd);
  const monthlyPending = calcTotalEarningsPending(earnings, monthStart, monthEnd);

  // AJUSTE 3: Gastos KM - somente os que estão com isPaid=true
  const paidExpenses = financials
    .filter((e) => e.type === "expense" && e.isPaid && isInRange(e.date, monthStart, monthEnd))
    .reduce((s, e) => s + e.value, 0);
  // AJUSTE 3: Corrigir bug - somar receitas lançadas no financeiro (income) ao saldo
  const financialIncome = financials
    .filter((e) => e.type === "income" && e.isPaid && isInRange(e.date, monthStart, monthEnd))
    .reduce((s, e) => s + e.value, 0);
  // Saldo usa apenas ganhos recebidos e gastos pagos
  const totalMonthlyExpenses = paidExpenses;

  const extraTotal = calcTotalExtraIncome(extraIncomes, monthStart, monthEnd);
  // AJUSTE 3: Saldo = ganhos recebidos + renda extra - gastos pagos
  // AJUSTE 1.2 + 3: Saldo = saldo inicial + ganhos recebidos + renda extra + receitas financeiro - gastos pagos
  const initialBalance = config.initialBalance || 0;
  const totalBalance = initialBalance + monthlyEarningsReceived + extraTotal + financialIncome - totalMonthlyExpenses;

  // AJUSTE 1: Contas a Vencer do Mês (não pagas, vencimento no mês corrente)
  const monthBillsUnpaid = financials.filter((e) => {
    if (e.type !== "expense" || e.isPaid) return false;
    const due = new Date(e.dueDate || e.date);
    return due >= monthStart && due <= monthEnd;
  });
  const totalMonthBillsUnpaid = monthBillsUnpaid.reduce((s, e) => s + e.value, 0);

  // AJUSTE 1: Meta semanal baseada na PRÓXIMA semana
  const workDays = config.workDaysPerWeek || 5;

  // AJUSTE 6.1: Contas da próxima semana - TODAS (pagas + não pagas) para meta fixa
  const nextWeekStart = new Date(weekEnd.getTime() + 86400000);
  const nextWeekBillsAll = getWeekBills(financials, nextWeekStart);
  const totalNextWeekBills = nextWeekBillsAll.reduce((s, e) => s + e.value, 0);
  const nextWeekBillsPaid = nextWeekBillsAll.filter((e) => e.isPaid).reduce((s, e) => s + e.value, 0);
  const nextWeekBills = nextWeekBillsAll;

  // AJUSTE 2 v6: Nova lógica de Meta Semanal baseada em KM Rodado Diário
  // O custo de KM rodado na semana atual é incrementado automaticamente à meta da próxima semana
  const currentWeekKms = dailyKms.filter((e) => isInRange(e.date, weekStart, weekEnd));
  const currentWeekTotalKm = currentWeekKms.reduce((s, e) => s + e.km, 0);
  const currentWeekKmCost = currentWeekTotalKm * config.costPerKm;

  // AJUSTE 7.1: Meta semanal: contas da próxima semana + custo KM + reserva de emergência (se habilitada)
  const reservePct = config.investmentPercentage || 0;
  const reserveInGoal = config.reserveInWeeklyGoal || false;
  const weeklyEarningsForReserve = weeklyEarnings;
  const reserveAmount = reserveInGoal ? (weeklyEarningsForReserve * reservePct / 100) : 0;
  const weeklyGoalTotal = totalNextWeekBills + currentWeekKmCost + reserveAmount;
  const dailyGoal = workDays > 0 ? weeklyGoalTotal / workDays : 0;

  // AJUSTE 6.1: Progresso = faturamento da semana + contas já pagas da próxima semana
  const weeklyProgress = weeklyEarnings + nextWeekBillsPaid;
  const weeklyRemaining = Math.max(0, weeklyGoalTotal - weeklyProgress);
  const daysRemaining = Math.max(1, workDays - Math.min(workDays, new Date().getDay() === 0 ? workDays : new Date().getDay()));
  const dailyRemainingGoal = daysRemaining > 0 ? weeklyRemaining / daysRemaining : 0;

  // AJUSTE 8.3: Média Dia projetada para a semana seguinte (inclui KM e reserva quando habilitada)
  const avgDiaNextWeek = workDays > 0 ? weeklyGoalTotal / workDays : 0;

  // Contas da semana navegável
  const weekBillsRef = getWeekBills(financials, weekRef);
  const weekBillsUnpaid = weekBillsRef.filter((e) => !e.isPaid);
  const weekBillsPaid = weekBillsRef.filter((e) => e.isPaid);
  const weekBillsTotal = weekBillsRef.reduce((s, e) => s + e.value, 0);

  // Gráfico mensal
  const monthlyData = getMonthlyDailyData(earnings, extraIncomes, financials, monthRef);

  // Alertas de limite
  const limits = config.spendingLimits || [];
  const overLimits = limits.filter((lim) => {
    const spent = getCategorySpending(financials, lim.category, lim.period);
    return spent >= lim.limit * 0.8;
  });

  // Backup
  const handleExport = async () => {
    try {
      const data = await exportData();
      if (Platform.OS === "web") {
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `MotoControle_backup_${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert("Backup exportado com sucesso!");
      } else {
        await Share.share({ message: data, title: "MotoControle Backup" });
      }
    } catch (err) {
      if (Platform.OS === "web") alert("Erro ao exportar"); else Alert.alert("Erro", "Falha ao exportar backup");
    }
  };

  const handleImport = async () => {
    if (!importJson.trim()) {
      if (Platform.OS === "web") alert("Cole o JSON do backup"); else Alert.alert("Atenção", "Cole o JSON do backup");
      return;
    }
    const success = await importData(importJson);
    if (success) {
      if (Platform.OS === "web") alert("Backup restaurado!"); else Alert.alert("Sucesso", "Backup restaurado!");
      setImportJson("");
    } else {
      if (Platform.OS === "web") alert("Erro: JSON inválido"); else Alert.alert("Erro", "JSON inválido");
    }
  };

  const handleClear = () => {
    const doIt = () => { clearAllData(); };
    if (Platform.OS === "web") {
      if (confirm("Tem certeza? Todos os dados serão apagados!")) doIt();
    } else {
      Alert.alert("Atenção", "Todos os dados serão apagados!", [
        { text: "Cancelar", style: "cancel" },
        { text: "Apagar Tudo", style: "destructive", onPress: doIt },
      ]);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Header com versão */}
        <View className="px-5 pt-4 pb-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-foreground">MotoControle</Text>
              <Text className="text-sm text-muted mt-1">Hoje: {todayFormatted()}</Text>
            </View>
            <View className="items-end">
              <Text className="text-xs text-muted">v{APP_VERSION}</Text>
              <TouchableOpacity onPress={() => setShowBackup(!showBackup)}>
                <IconSymbol name="gearshape.fill" size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Backup/Restauração */}
        {showBackup && (
          <View className="mx-5 mb-4 bg-surface border border-border rounded-2xl p-4">
            <Text className="text-sm font-bold text-foreground mb-3">Backup & Restauração</Text>
            <View className="flex-row gap-2 mb-3">
              <TouchableOpacity onPress={handleExport}
                style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Exportar Backup</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClear}
                style={{ flex: 1, backgroundColor: colors.error, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Limpar Dados</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-muted mb-1">Para restaurar, cole o JSON do backup abaixo:</Text>
            <TextInput
              className="bg-background border border-border rounded-xl p-2 text-foreground text-xs"
              style={{ minHeight: 60 }}
              multiline
              placeholder="Cole aqui o JSON do backup..."
              placeholderTextColor={colors.muted}
              value={importJson}
              onChangeText={setImportJson}
            />
            {importJson.trim().length > 0 && (
              <TouchableOpacity onPress={handleImport}
                style={{ backgroundColor: colors.success, borderRadius: 12, paddingVertical: 10, alignItems: "center", marginTop: 8 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Restaurar Backup</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Alertas de limite */}
        {overLimits.length > 0 && (
          <View className="mx-5 mb-4 bg-yellow-500/10 border-2 border-yellow-500 rounded-2xl p-4">
            <View className="flex-row items-center mb-2">
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
              <Text className="text-sm font-bold ml-2" style={{ color: colors.warning }}>Alertas de Limite</Text>
            </View>
            {overLimits.map((lim, i) => {
              const spent = getCategorySpending(financials, lim.category, lim.period);
              const pct = lim.limit > 0 ? (spent / lim.limit) * 100 : 0;
              return (
                <Text key={i} className="text-xs text-foreground ml-6 mb-1">
                  • {lim.category}: {pct.toFixed(0)}% ({formatCurrency(spent)} / {formatCurrency(lim.limit)})
                  {pct >= 100 ? " - ULTRAPASSADO!" : " - Atenção!"}
                </Text>
              );
            })}
          </View>
        )}

        {/* AJUSTE 1: Meta Semanal - projetada para a PRÓXIMA semana */}
        <View className="mx-5 mb-4 bg-surface border-2 rounded-2xl p-4" style={{ borderColor: weeklyRemaining > 0 ? colors.warning : colors.success }}>
          <View className="flex-row items-center mb-2">
            <IconSymbol name="target" size={20} color={weeklyRemaining > 0 ? colors.warning : colors.success} />
            <Text className="text-base font-bold text-foreground ml-2">Meta Semanal (Próxima Semana)</Text>
          </View>

          {weeklyGoalTotal > 0 ? (
            <>
              <Text className="text-xs text-muted mb-1">
                Contas da próxima semana: {formatCurrency(totalNextWeekBills)}
              </Text>
              {reserveAmount > 0 && (
                <Text className="text-xs text-muted mb-1">
                  Reserva de Emergência ({reservePct}%): {formatCurrency(reserveAmount)}
                </Text>
              )}
              {currentWeekKmCost > 0 && (
                <Text className="text-xs text-muted mb-1">
                  Custo KM acumulado ({currentWeekTotalKm.toFixed(0)} km × {formatCurrency(config.costPerKm)}/km):
                  {" "}{formatCurrency(currentWeekKmCost)}
                </Text>
              )}
              <Text className="text-xs text-muted mb-2">
                Total a faturar esta semana: {formatCurrency(weeklyGoalTotal)} em {workDays} dias de trabalho
              </Text>

              {/* Barra de progresso */}
              <View className="bg-background rounded-full h-4 mb-2 overflow-hidden">
                <View style={{
                  width: `${Math.min(100, (weeklyProgress / weeklyGoalTotal) * 100)}%`,
                  height: "100%",
                  backgroundColor: weeklyProgress >= weeklyGoalTotal ? colors.success : colors.primary,
                  borderRadius: 999,
                }} />
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-xs font-bold text-foreground">
                  {formatCurrency(weeklyProgress)} / {formatCurrency(weeklyGoalTotal)}
                </Text>
                <Text className="text-xs text-muted">{((weeklyProgress / weeklyGoalTotal) * 100).toFixed(0)}%</Text>
              </View>

              {weeklyRemaining > 0 ? (
                <View className="bg-warning/10 rounded-xl p-3 mt-1">
                  <Text className="text-sm font-bold" style={{ color: colors.warning }}>
                    Falta {formatCurrency(weeklyRemaining)}
                  </Text>
                  <Text className="text-xs text-muted mt-1">
                    Precisa fazer ~{formatCurrency(dailyRemainingGoal)}/dia nos próximos {daysRemaining} dia(s)
                  </Text>
                </View>
              ) : (
                <View className="bg-green-500/10 rounded-xl p-3 mt-1">
                  <Text className="text-sm font-bold" style={{ color: colors.success }}>
                    Meta atingida! Parabéns!
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text className="text-xs text-muted">Nenhuma conta pendente para a próxima semana. Cadastre contas no Financeiro.</Text>
          )}
        </View>

        {/* AJUSTE 1: Média Dia projetada para a próxima semana */}
        {weeklyGoalTotal > 0 && (
          <View className="mx-5 mb-4 bg-surface border border-warning/30 rounded-2xl p-4">
            <View className="flex-row items-center mb-1">
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />
              <Text className="text-sm font-semibold text-foreground ml-2">Média Dia (Próxima Semana)</Text>
            </View>
            <Text className="text-xs text-muted">
              Contas da próxima semana: {formatCurrency(totalNextWeekBills)}
            </Text>
            <Text className="text-xs text-muted">
              Se trabalhar {workDays} dias, precisa fazer {formatCurrency(avgDiaNextWeek)} por dia.
            </Text>
            <Text className="text-lg font-bold text-foreground mt-1">
              {formatCurrency(avgDiaNextWeek)}/dia
            </Text>
          </View>
        )}

        {/* AJUSTE 1: Card "Contas a Vencer do Mês" + Stats Grid */}
        <View className="px-5 gap-3">
          <View className="flex-row gap-3">
            <StatCard title="Saldo" value={formatCurrency(totalBalance)}
              icon={<IconSymbol name="dollarsign.circle.fill" size={18} color={totalBalance >= 0 ? colors.success : colors.error} />} />
            <StatCard title="Ganhos Mês" value={formatCurrency(monthlyEarnings)}
              icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={18} color={colors.success} />} />
          </View>
          <View className="flex-row gap-3">
            {/* AJUSTE 1: Card "Contas a Vencer do Mês" ao lado de Ganhos Semana */}
            <StatCard title="Contas a Vencer" value={formatCurrency(totalMonthBillsUnpaid)}
              icon={<IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.warning} />} />
            <StatCard title="Ganhos Semana" value={formatCurrency(weeklyEarnings)}
              icon={<IconSymbol name="calendar" size={18} color={colors.primary} />} />
          </View>
          <View className="flex-row gap-3">
            <StatCard title="Renda Extra" value={formatCurrency(extraTotal)}
              icon={<IconSymbol name="plus.circle.fill" size={18} color={colors.success} />} />
            <StatCard title="Gasto do Mês" value={formatCurrency(totalMonthlyExpenses)}
              icon={<IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.error} />} />
          </View>
          <View className="flex-row gap-3">
            <StatCard title="KM Rodado" value={`${totalKm.toFixed(0)} km`}
              icon={<IconSymbol name="speedometer" size={18} color={colors.muted} />} />
            {monthlyPending > 0 ? (
              <StatCard title="Pendente Apps" value={formatCurrency(monthlyPending)}
                icon={<IconSymbol name="clock.fill" size={18} color={colors.warning} />} />
            ) : (
              <View className="flex-1" />
            )}
          </View>
        </View>

        {/* Contas da Semana */}
        <View className="mx-5 mt-4 mb-4 bg-surface border border-border rounded-2xl p-4">
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

          {/* AJUSTE 6: Cards de Contas da Semana - fonte maior, negrito, layout vertical */}
          {weekBillsUnpaid.length > 0 && (
            <>
              <Text className="text-sm font-bold mb-2" style={{ color: colors.warning }}>A Pagar:</Text>
              {weekBillsUnpaid.map((e) => (
                <View key={e.id} className="bg-background border border-border rounded-xl p-3 mb-2">
                  <Text className="text-base font-bold text-foreground">{e.description || e.category}</Text>
                  <Text className="text-sm font-bold text-muted mt-1">{formatDate(e.dueDate || e.date)}</Text>
                  <Text className="text-base font-bold mt-1" style={{ color: colors.error }}>{formatCurrency(e.value)}</Text>
                </View>
              ))}
            </>
          )}
          {weekBillsPaid.length > 0 && (
            <>
              <Text className="text-sm font-bold mt-2 mb-2" style={{ color: colors.success }}>Pagas:</Text>
              {weekBillsPaid.map((e) => (
                <View key={e.id} className="bg-background border border-border rounded-xl p-3 mb-2" style={{ opacity: 0.7 }}>
                  <Text className="text-base font-bold text-muted line-through">{e.description || e.category}</Text>
                  <Text className="text-sm font-bold text-muted mt-1">{formatDate(e.dueDate || e.date)}</Text>
                  <Text className="text-base font-bold text-muted mt-1">{formatCurrency(e.value)}</Text>
                </View>
              ))}
            </>
          )}
          {weekBillsRef.length === 0 && (
            <Text className="text-xs text-muted text-center py-2">Nenhuma conta nesta semana</Text>
          )}
        </View>

        {/* Gráfico Ganhos vs Gastos */}
        <View className="mx-5 mt-4 bg-surface rounded-2xl p-4 border border-border">
          <Text className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
            Ganhos vs Gastos (Mês)
          </Text>
          <SimpleBarChart
            labels={["Ganhos", "Gastos"]}
            data={[monthlyEarnings + extraTotal, totalMonthlyExpenses]}
            barColors={["#4ADE80", "#F87171"]}
            height={120} showValues showTotal
          />
        </View>

        {/* Gráfico de Linhas */}
        <View className="mx-5 mt-4 bg-surface rounded-2xl p-4 border border-border">
          <Text className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
            Ganhos do Mês
          </Text>
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
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
