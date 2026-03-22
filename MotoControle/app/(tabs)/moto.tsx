import { useState, useEffect, useMemo } from "react";
import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, Platform, Switch, Share } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Card, StatCard } from "@/components/ui/card";
import { SimpleBarChart, SimpleLineChart, DateNavigator, GroupedBarChart } from "@/components/ui/simple-chart";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useData } from "@/lib/data-context";
import { useColors } from "@/hooks/use-colors";
import {
  calcTotalEarnings, calcTotalEarningsReceived, calcTotalEarningsPending,
  calcTotalKm, calcAvgPerKm, calcCostPerKm, calcNetProfit,
  calcMaintenanceCost, calcFullForecast,
  getCostRealData, getWeeklyEarningsData, getMonthlyEarningsByApp,
  getWeeklyEarningsByApp,
  getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth,
  formatCurrency, formatDate, todayStr, todayFormatted, parseDateInput,
  shiftWeek, shiftMonth, formatWeekRange, formatMonthRange,
  isInRange, getAppColor, APP_COLORS, isWeekClosed, getPaymentDate,
  type CostPeriod,
} from "@/lib/calculations";

type SubTab = "geral" | "ganhos" | "km" | "manutencao" | "media" | "previsao" | "horas" | "config";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "geral", label: "Geral" },
  { key: "ganhos", label: "Ganhos" },
  { key: "km", label: "KM" },
  { key: "manutencao", label: "Manutenção" },
  { key: "media", label: "Média" },
  { key: "previsao", label: "Previsão" },
  { key: "horas", label: "Horas" },
  { key: "config", label: "Config" },
];

export default function MotoScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>("geral");
  const colors = useColors();

  return (
    <ScreenContainer>
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

      {activeTab === "geral" && <GeralTab />}
      {activeTab === "ganhos" && <GanhosTab />}
      {activeTab === "km" && <KmTab />}
      {activeTab === "manutencao" && <ManutencaoTab />}
      {activeTab === "media" && <MediaTab />}
      {activeTab === "previsao" && <PrevisaoTab />}
      {activeTab === "horas" && <HorasTab />}
      {activeTab === "config" && <ConfigTab />}
    </ScreenContainer>
  );
}

// ==================== GERAL ====================
function GeralTab() {
  const { earnings, dailyKms, maintenance, workShifts, config } = useData();
  const colors = useColors();
  const [period, setPeriod] = useState<CostPeriod>("weekly");
  const [refDate, setRefDate] = useState(new Date());
  const [customStartStr, setCustomStartStr] = useState(todayFormatted());
  const [customEndStr, setCustomEndStr] = useState(todayFormatted());

  const customStart = period === "custom" ? new Date(parseDateInput(customStartStr)) : undefined;
  const customEnd = period === "custom" ? new Date(parseDateInput(customEndStr)) : undefined;

  const data = getCostRealData(earnings, dailyKms, maintenance, config.costPerKm, period, refDate, customStart, customEnd);

  const handlePrev = () => {
    if (period === "daily") setRefDate(new Date(refDate.getTime() - 86400000));
    else if (period === "weekly") setRefDate(shiftWeek(refDate, -1));
    else if (period === "monthly") setRefDate(shiftMonth(refDate, -1));
  };
  const handleNext = () => {
    if (period === "daily") setRefDate(new Date(refDate.getTime() + 86400000));
    else if (period === "weekly") setRefDate(shiftWeek(refDate, 1));
    else if (period === "monthly") setRefDate(shiftMonth(refDate, 1));
  };

  const navLabel = period === "daily"
    ? formatDate(refDate.toISOString())
    : period === "weekly" ? formatWeekRange(refDate)
    : period === "monthly" ? formatMonthRange(refDate)
    : `${customStartStr} - ${customEndStr}`;

  // Horas trabalhadas no período
  const periodStart = period === "daily"
    ? new Date(refDate.toISOString().split("T")[0] + "T00:00:00")
    : period === "weekly" ? getStartOfWeek(refDate)
    : period === "monthly" ? getStartOfMonth(refDate)
    : customStart || new Date();
  const periodEnd = period === "daily"
    ? new Date(refDate.toISOString().split("T")[0] + "T23:59:59")
    : period === "weekly" ? getEndOfWeek(refDate)
    : period === "monthly" ? getEndOfMonth(refDate)
    : customEnd || new Date();

  const periodShifts = workShifts.filter((s) => isInRange(s.date, periodStart, periodEnd));
  const totalMinutes = periodShifts.reduce((s, sh) => s + sh.durationMinutes, 0);
  const totalHours = totalMinutes / 60;
  const reaisPerHora = totalHours > 0 ? data.totalEarnings / totalHours : 0;

  const chartLabels = ["Ganhos", "Custo KM", "Manutenção", "Lucro"];
  const chartData = [
    data.totalEarnings,
    data.kmCost,
    data.maintenanceCost,
    Math.max(0, data.netProfit),
  ];
  const chartColors = ["#4ADE80", "#FBBF24", "#F87171", "#2196F3"];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Visão Geral</Text>

        <View className="flex-row flex-wrap gap-2 mb-3">
          {(["daily", "weekly", "monthly", "custom"] as CostPeriod[]).map((p) => (
            <TouchableOpacity key={p} onPress={() => { setPeriod(p); setRefDate(new Date()); }}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                backgroundColor: period === p ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: period === p ? colors.primary : colors.border,
              }}>
              <Text style={{ color: period === p ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                {p === "daily" ? "Diário" : p === "weekly" ? "Semanal" : p === "monthly" ? "Mensal" : "Personalizado"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {period !== "custom" && (
          <DateNavigator label={navLabel} onPrev={handlePrev} onNext={handleNext} />
        )}

        {period === "custom" && (
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Início</Text>
              <TextInput className="bg-surface border border-border rounded-xl px-3 py-2 text-foreground"
                placeholder="DD/MM/AA" placeholderTextColor={colors.muted}
                value={customStartStr} onChangeText={setCustomStartStr} returnKeyType="done" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Fim</Text>
              <TextInput className="bg-surface border border-border rounded-xl px-3 py-2 text-foreground"
                placeholder="DD/MM/AA" placeholderTextColor={colors.muted}
                value={customEndStr} onChangeText={setCustomEndStr} returnKeyType="done" />
            </View>
          </View>
        )}

        <View className="flex-row gap-3 mb-3">
          <StatCard title="Faturamento" value={formatCurrency(data.totalEarnings)}
            icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={colors.success} />} />
          <StatCard title="KM Rodado" value={`${data.totalKm.toFixed(0)} km`}
            icon={<IconSymbol name="speedometer" size={16} color={colors.primary} />} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Custo KM" value={formatCurrency(data.kmCost)}
            icon={<IconSymbol name="fuelpump.fill" size={16} color={colors.warning} />} />
          <StatCard title="Manutenção" value={formatCurrency(data.maintenanceCost)}
            icon={<IconSymbol name="wrench.fill" size={16} color={colors.error} />} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Lucro Líquido" value={formatCurrency(data.netProfit)}
            icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={data.netProfit >= 0 ? colors.success : colors.error} />} />
          <StatCard title="R$/KM" value={formatCurrency(data.avgPerKm)}
            icon={<IconSymbol name="gauge.medium" size={16} color={colors.muted} />} />
        </View>

        {/* Card de Horas Trabalhadas */}
        {totalHours > 0 && (
          <View className="flex-row gap-3 mb-3">
            <StatCard title="Horas Trabalhadas" value={`${totalHours.toFixed(1)}h`}
              icon={<IconSymbol name="clock.fill" size={16} color={colors.primary} />} />
            <StatCard title="R$/Hora" value={formatCurrency(reaisPerHora)}
              icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={colors.success} />} />
          </View>
        )}

        {/* Gráfico padronizado — sem total */}
        <Card title={`Gráfico ${period === "daily" ? "Diário" : period === "weekly" ? "Semanal" : period === "monthly" ? "Mensal" : "Personalizado"}`} className="mb-4">
          <SimpleBarChart
            labels={chartLabels}
            data={chartData}
            barColors={chartColors}
            showValues
            height={140}
          />
        </Card>
      </View>
    </ScrollView>
  );
}

// ==================== GANHOS ====================
function GanhosTab() {
  const { earnings, addEarning, updateEarning, removeEarning, config, addWalletTransaction } = useData();
  const colors = useColors();
  const [appName, setAppName] = useState(config.apps[0] || "iFood");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayFormatted());
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [refDate, setRefDate] = useState(new Date());

  const start = period === "week" ? getStartOfWeek(refDate) : getStartOfMonth(refDate);
  const end = period === "week" ? getEndOfWeek(refDate) : getEndOfMonth(refDate);

  const filtered = earnings.filter((e) => isInRange(e.date, start, end));
  const totalBruto = filtered.reduce((s, e) => s + e.value, 0);
  const totalRecebido = filtered.reduce((s, e) => s + (e.receivedValue || 0), 0);
  const totalPendente = totalBruto - totalRecebido;

  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSave = async () => {
    if (!value) {
      if (Platform.OS === "web") alert("Preencha o valor"); else Alert.alert("Atenção", "Preencha o valor");
      return;
    }
    await addEarning({
      appName,
      value: parseFloat(value.replace(",", ".")),
      date: parseDateInput(date),
      status: "pending",
    });
    setValue("");
  };

  useEffect(() => {
    const autoReceive = async () => {
      const paymentConfigs = config.appPaymentConfigs || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      for (const earning of earnings) {
        if (earning.status !== "pending") continue;
        const appConfig = paymentConfigs.find((p) => p.appName === earning.appName);
        if (!appConfig) continue;
        if (appConfig.paymentMode === "instant") {
          await updateEarning(earning.id, { status: "received", receivedValue: earning.value, receivedDate: earning.date });
          continue;
        }
        if (appConfig.paymentMode === "next_day") {
          const earningDate = new Date(earning.date + "T12:00:00");
          const nextDay = new Date(earningDate);
          nextDay.setDate(nextDay.getDate() + 1);
          nextDay.setHours(0, 0, 0, 0);
          if (today >= nextDay) {
            await updateEarning(earning.id, { status: "received", receivedValue: earning.value, receivedDate: nextDay.toISOString().split("T")[0] });
          }
          continue;
        }
        const earningDate = new Date(earning.date + "T12:00:00");
        const weekEnd = getEndOfWeek(earningDate);
        const payDate = getPaymentDate(weekEnd, appConfig.paymentMode);
        if (!payDate) continue;
        if (today >= payDate) {
          await updateEarning(earning.id, { status: "received", receivedValue: earning.value, receivedDate: payDate.toISOString().split("T")[0] });
        }
      }
    };
    autoReceive();
  }, [earnings.length, config.appPaymentConfigs]);

  const navLabel = period === "week" ? formatWeekRange(refDate) : formatMonthRange(refDate);
  const handlePrev = () => setRefDate(period === "week" ? shiftWeek(refDate, -1) : shiftMonth(refDate, -1));
  const handleNext = () => setRefDate(period === "week" ? shiftWeek(refDate, 1) : shiftMonth(refDate, 1));

  // Cores dos apps vindo das configs
  const appColors = config.appColors || {};
  const getColor = (app: string) => appColors[app] || getAppColor(app);

  const byApp: Record<string, number> = {};
  filtered.forEach((e) => { byApp[e.appName] = (byApp[e.appName] || 0) + e.value; });

  const weeklyByApp = period === "week" ? getWeeklyEarningsByApp(earnings, refDate) : null;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Ganhos dos Apps</Text>

        <View className="flex-row gap-2 mb-3">
          {(["week", "month"] as const).map((p) => (
            <TouchableOpacity key={p} onPress={() => { setPeriod(p); setRefDate(new Date()); }}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: period === p ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: period === p ? colors.primary : colors.border,
              }}>
              <Text style={{ color: period === p ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                {p === "week" ? "Semana" : "Mês"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <DateNavigator label={navLabel} onPrev={handlePrev} onNext={handleNext} />

        <View className="flex-row gap-3 mb-3">
          <StatCard title="Bruto" value={formatCurrency(totalBruto)} />
          <StatCard title="Recebido" value={formatCurrency(totalRecebido)} />
        </View>
        <View className="flex-row gap-3 mb-4">
          <StatCard title="Pendente" value={formatCurrency(totalPendente)} />
          <StatCard title="Lançamentos" value={filtered.length.toString()} />
        </View>

        {Object.keys(byApp).length > 0 && (
          <Card title="Ganhos por App" className="mb-4">
            <SimpleBarChart
              labels={Object.keys(byApp)}
              data={Object.values(byApp)}
              barColors={Object.keys(byApp).map((a) => getColor(a))}
              showValues height={140}
            />
          </Card>
        )}

        {period === "week" && weeklyByApp && weeklyByApp.datasets.length > 0 && (
          <Card title="Ganhos Diários por App (R$)" className="mb-4">
            <GroupedBarChart
              labels={weeklyByApp.labels}
              datasets={weeklyByApp.datasets.map((ds) => ({
                data: ds.data,
                color: getColor(ds.appName),
                label: ds.appName,
              }))}
              height={200} width={340} showValues
              formatValue={(v) => `R$${v.toFixed(0)}`}
            />
          </Card>
        )}

        <Text className="text-base font-bold text-foreground mb-3">Novo Lançamento</Text>

        <Text className="text-xs text-muted mb-1 uppercase">Aplicativo</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {config.apps.map((app) => (
            <TouchableOpacity key={app} onPress={() => setAppName(app)}
              style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginRight: 8,
                backgroundColor: appName === app ? getColor(app) : colors.surface,
                borderWidth: 1, borderColor: appName === app ? getColor(app) : colors.border,
              }}>
              <Text style={{ color: appName === app ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                {app}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Valor (R$)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="0,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={value} onChangeText={setValue} returnKeyType="done" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Data</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="DD/MM/AA" placeholderTextColor={colors.muted}
              value={date} onChangeText={setDate} returnKeyType="done" />
          </View>
        </View>

        <TouchableOpacity onPress={handleSave}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginBottom: 16 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Lançar Ganho</Text>
        </TouchableOpacity>

        <Text className="text-sm font-semibold text-muted mb-2 uppercase">Histórico</Text>
        {sorted.map((e) => (
          <View key={e.id} className="bg-surface border border-border rounded-xl p-3 mb-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <View className="flex-row items-center">
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: getColor(e.appName), marginRight: 6 }} />
                  <Text className="text-sm font-semibold text-foreground">{e.appName}</Text>
                </View>
                <Text className="text-xs text-muted mt-0.5">
                  {formatDate(e.date)} •{" "}
                  <Text style={{ color: e.status === "received" ? colors.success : (e.receivedValue && e.receivedValue > 0) ? colors.warning : colors.muted }}>
                    {e.status === "received" ? "Recebido"
                      : (e.receivedValue && e.receivedValue > 0)
                        ? `Parcial (${formatCurrency(e.receivedValue)} de ${formatCurrency(e.value)})`
                        : "Pendente"}
                  </Text>
                  {e.receivedDate ? ` • ${formatDate(e.receivedDate)}` : ""}
                </Text>
              </View>
              <Text className="text-base font-bold mr-2" style={{ color: e.status === "received" ? colors.success : colors.foreground }}>
                {formatCurrency(e.value)}
              </Text>
              <TouchableOpacity onPress={() => removeEarning(e.id)} style={{ padding: 4 }}>
                <IconSymbol name="trash.fill" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {sorted.length === 0 && <Text className="text-sm text-muted text-center py-4">Nenhum ganho no período</Text>}

        <BaixaManualSection earnings={filtered} updateEarning={updateEarning} addEarning={addEarning} config={config} colors={colors} getColor={getColor} />
      </View>
    </ScrollView>
  );
}

// ==================== BAIXA MANUAL ====================
function BaixaManualSection({ earnings: filtered, updateEarning, addEarning, config, colors, getColor }: any) {
  const [selectedApp, setSelectedApp] = useState(config.apps[0] || "");
  const [receiveValue, setReceiveValue] = useState("");

  const pendingByApp: Record<string, { total: number; ids: string[] }> = {};
  filtered.forEach((e: any) => {
    if (e.status === "received") return;
    const pendingValue = e.value - (e.receivedValue || 0);
    if (pendingValue <= 0) return;
    if (!pendingByApp[e.appName]) pendingByApp[e.appName] = { total: 0, ids: [] };
    pendingByApp[e.appName].total += pendingValue;
    pendingByApp[e.appName].ids.push(e.id);
  });

  const handleBaixaManual = async () => {
    if (!receiveValue || !selectedApp) {
      if (Platform.OS === "web") alert("Selecione um app e informe o valor");
      else Alert.alert("Atenção", "Selecione um app e informe o valor");
      return;
    }
    const parsedValue = parseFloat(receiveValue.replace(",", "."));
    if (parsedValue <= 0) return;
    const appPending = pendingByApp[selectedApp];
    if (!appPending || appPending.total <= 0) {
      if (Platform.OS === "web") alert("Nenhum valor pendente para este app");
      else Alert.alert("Aviso", "Nenhum valor pendente para este app");
      return;
    }
    let remaining = parsedValue;
    const pendingEarnings = filtered
      .filter((e: any) => e.appName === selectedApp && e.status !== "received")
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const todayStr2 = new Date().toISOString().split("T")[0];
    for (const earning of pendingEarnings) {
      if (remaining <= 0) break;
      const alreadyReceived = earning.receivedValue || 0;
      const stillPending = earning.value - alreadyReceived;
      if (stillPending <= 0) continue;
      if (remaining >= stillPending) {
        await updateEarning(earning.id, { status: "received", receivedValue: earning.value, receivedDate: todayStr2 });
        remaining -= stillPending;
      } else {
        await updateEarning(earning.id, { status: "pending", receivedValue: alreadyReceived + remaining, receivedDate: todayStr2 });
        remaining = 0;
      }
    }
    setReceiveValue("");
    if (Platform.OS === "web") alert(`Baixa de ${formatCurrency(parsedValue)} no ${selectedApp} realizada!`);
    else Alert.alert("Sucesso", `Baixa de ${formatCurrency(parsedValue)} no ${selectedApp} realizada!`);
  };

  return (
    <Card title="Baixa Manual de Recebimentos" className="mt-4 mb-4">
      <Text className="text-xs text-muted mb-3">Selecione o aplicativo e informe o valor recebido para dar baixa manual.</Text>
      {Object.keys(pendingByApp).length > 0 && (
        <View className="mb-3">
          <Text className="text-xs font-semibold text-muted mb-2 uppercase">Pendente por App</Text>
          {Object.entries(pendingByApp).map(([app, data]: [string, any]) => (
            <View key={app} className="flex-row justify-between items-center py-1.5 border-b border-border/50">
              <View className="flex-row items-center">
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getColor(app), marginRight: 6 }} />
                <Text className="text-sm text-foreground">{app}</Text>
              </View>
              <Text className="text-sm font-bold" style={{ color: colors.warning }}>{formatCurrency(data.total)}</Text>
            </View>
          ))}
        </View>
      )}
      <Text className="text-xs text-muted mb-1 uppercase">Aplicativo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {config.apps.map((app: string) => (
          <TouchableOpacity key={app} onPress={() => setSelectedApp(app)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginRight: 8,
              backgroundColor: selectedApp === app ? getColor(app) : colors.surface,
              borderWidth: 1, borderColor: selectedApp === app ? getColor(app) : colors.border,
            }}>
            <Text style={{ color: selectedApp === app ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 12 }}>{app}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text className="text-xs text-muted mb-1 uppercase">Valor Recebido (R$)</Text>
      <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
        placeholder="0,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
        value={receiveValue} onChangeText={setReceiveValue} returnKeyType="done" />
      <TouchableOpacity onPress={handleBaixaManual}
        style={{ backgroundColor: colors.success, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Dar Baixa Manual</Text>
      </TouchableOpacity>
    </Card>
  );
}

// ==================== KM ====================
function KmTab() {
  const { dailyKms, addDailyKm, removeDailyKm, config, weeklyKmCosts, addWeeklyKmCost, updateWeeklyKmCost, addFinancial, addWalletTransaction } = useData();
  const colors = useColors();
  const [km, setKm] = useState("");
  const [date, setDate] = useState(todayFormatted());
  const [refDate, setRefDate] = useState(new Date());

  const start = getStartOfWeek(refDate);
  const end = getEndOfWeek(refDate);
  const weekKms = dailyKms.filter((e) => isInRange(e.date, start, end));
  const totalWeekKm = weekKms.reduce((s, e) => s + e.km, 0);
  const weekCost = totalWeekKm * config.costPerKm;

  const weekKey = `${start.toISOString().split("T")[0]}`;
  const existingWeeklyCost = weeklyKmCosts.find((w) => w.weekStart === weekKey);

  useEffect(() => {
    const checkAutoClose = async () => {
      if (existingWeeklyCost) return;
      if (totalWeekKm <= 0) return;
      if (isWeekClosed(refDate)) {
        await addWeeklyKmCost({
          weekStart: start.toISOString().split("T")[0],
          weekEnd: end.toISOString().split("T")[0],
          totalKm: totalWeekKm, costPerKm: config.costPerKm,
          totalCost: weekCost, status: "closed",
        });
        const nextWednesday = getPaymentDate(end, "wednesday");
        const dueDate = nextWednesday ? nextWednesday.toISOString().split("T")[0] : end.toISOString().split("T")[0];
        await addFinancial({
          type: "expense", category: "Combustível",
          description: `Custo KM Semana ${formatDate(start.toISOString())} - ${formatDate(end.toISOString())}`,
          value: weekCost, date: end.toISOString().split("T")[0], dueDate,
          isPaid: false, isFixed: false, isInstallment: false,
        });
      }
    };
    checkAutoClose();
  }, [refDate, existingWeeklyCost, totalWeekKm]);

  const handleSave = async () => {
    if (!km) return;
    await addDailyKm({ km: parseFloat(km.replace(",", ".")), date: parseDateInput(date) });
    setKm("");
  };

  const handleCloseWeek = async () => {
    if (existingWeeklyCost) {
      if (Platform.OS === "web") alert("Semana já fechada!"); else Alert.alert("Aviso", "Semana já fechada!");
      return;
    }
    await addWeeklyKmCost({
      weekStart: start.toISOString().split("T")[0],
      weekEnd: end.toISOString().split("T")[0],
      totalKm: totalWeekKm, costPerKm: config.costPerKm,
      totalCost: weekCost, status: "closed",
    });
    const nextWednesday = getPaymentDate(end, "wednesday");
    const dueDate = nextWednesday ? nextWednesday.toISOString().split("T")[0] : end.toISOString().split("T")[0];
    await addFinancial({
      type: "expense", category: "Combustível",
      description: `Custo KM Semana ${formatDate(start.toISOString())} - ${formatDate(end.toISOString())}`,
      value: weekCost, date: end.toISOString().split("T")[0], dueDate,
      isPaid: false, isFixed: false, isInstallment: false,
    });
    if (Platform.OS === "web") alert(`Custo KM de ${formatCurrency(weekCost)} lançado!`);
    else Alert.alert("Sucesso", `Custo KM de ${formatCurrency(weekCost)} lançado!`);
  };

  const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const kmPerDay = new Array(7).fill(0);
  weekKms.forEach((e) => {
    const d = new Date(e.date + "T12:00:00");
    let idx = d.getDay() - 1;
    if (idx < 0) idx = 6;
    kmPerDay[idx] += e.km;
  });

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">KM Rodado</Text>
        <DateNavigator label={formatWeekRange(refDate)}
          onPrev={() => setRefDate(shiftWeek(refDate, -1))}
          onNext={() => setRefDate(shiftWeek(refDate, 1))} />
        <View className="flex-row gap-3 mb-3">
          <StatCard title="KM da Semana" value={`${totalWeekKm.toFixed(0)} km`} />
          <StatCard title="Custo KM" value={formatCurrency(weekCost)} />
        </View>
        <View className="bg-surface border rounded-xl p-3 mb-4" style={{ borderColor: existingWeeklyCost ? colors.success : colors.warning }}>
          <Text className="text-sm font-semibold" style={{ color: existingWeeklyCost ? colors.success : colors.warning }}>
            {existingWeeklyCost ? "Semana Fechada" : isWeekClosed(refDate) && totalWeekKm > 0 ? "Fechamento Automático" : "Semana Aberta"}
          </Text>
          <Text className="text-xs text-muted mt-1">
            {existingWeeklyCost
              ? `Custo de ${formatCurrency(existingWeeklyCost.totalCost)} lançado no financeiro`
              : isWeekClosed(refDate) && totalWeekKm > 0
              ? "A semana terminou. O fechamento automático será processado."
              : "O custo KM será lançado automaticamente ao final do domingo"}
          </Text>
          {!existingWeeklyCost && totalWeekKm > 0 && !isWeekClosed(refDate) && (
            <TouchableOpacity onPress={handleCloseWeek}
              style={{ backgroundColor: colors.warning, borderRadius: 10, paddingVertical: 8, alignItems: "center", marginTop: 8 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Fechar Semana Manualmente</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Gráfico KM em números, não em R$ */}
        <Card title="KM por Dia" className="mb-4">
          <SimpleBarChart
            labels={days}
            data={kmPerDay}
            color="#4ADE80"
            showValues
            height={120}
            formatValue={(v) => `${v.toFixed(0)}`}
          />
        </Card>

        <Text className="text-base font-bold text-foreground mb-3">Registrar KM</Text>
        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">KM</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="0" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={km} onChangeText={setKm} returnKeyType="done" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Data</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="DD/MM/AA" placeholderTextColor={colors.muted}
              value={date} onChangeText={setDate} returnKeyType="done" />
          </View>
        </View>
        <TouchableOpacity onPress={handleSave}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Salvar KM</Text>
        </TouchableOpacity>

        <Text className="text-sm font-semibold text-muted mt-5 mb-2 uppercase">Histórico da Semana</Text>
        {weekKms.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((e) => (
          <View key={e.id} className="flex-row items-center bg-surface border border-border rounded-xl p-3 mb-2">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{e.km.toFixed(1)} km</Text>
              <Text className="text-xs text-muted">{formatDate(e.date)}</Text>
            </View>
            <Text className="text-sm text-muted mr-3">{formatCurrency(e.km * config.costPerKm)}</Text>
            <TouchableOpacity onPress={() => removeDailyKm(e.id)} style={{ padding: 4 }}>
              <IconSymbol name="trash.fill" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ==================== MANUTENÇÃO ====================
function ManutencaoTab() {
  const { maintenance, addMaintenance, removeMaintenance, config, addWalletTransaction } = useData();
  const colors = useColors();
  const maintenanceCats = config.maintenanceCategories || config.maintenanceItems || [];
  const [item, setItem] = useState(maintenanceCats[0] || "");
  const [kmVal, setKmVal] = useState("");
  const [value, setValue] = useState("");
  const [location, setLocation] = useState("");
  const [selectedWorkshop, setSelectedWorkshop] = useState("");
  const [date, setDate] = useState(todayFormatted());
  const [viewMode, setViewMode] = useState<"year" | "month">("year");
  const [refDate, setRefDate] = useState(new Date());
  const workshops = config.workshops || [];

  const handleSave = async () => {
    if (!item || !value) {
      if (Platform.OS === "web") alert("Preencha item e valor"); else Alert.alert("Atenção", "Preencha item e valor");
      return;
    }
    const loc = selectedWorkshop || location;
    await addMaintenance({
      item, km: parseFloat(kmVal.replace(",", ".") || "0"),
      value: parseFloat(value.replace(",", ".")), location: loc, date: parseDateInput(date),
    });
    setKmVal(""); setValue(""); setLocation(""); setSelectedWorkshop("");
  };

  const year = refDate.getFullYear();
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const annualData = new Array(12).fill(0);
  maintenance.forEach((m) => {
    const d = new Date(m.date + "T12:00:00");
    if (d.getFullYear() === year) annualData[d.getMonth()] += m.value;
  });
  const totalAnual = annualData.reduce((s, v) => s + v, 0);
  const monthStart = getStartOfMonth(refDate);
  const monthEnd = getEndOfMonth(refDate);
  const monthMaint = maintenance.filter((m) => isInRange(m.date, monthStart, monthEnd));
  const byItem: Record<string, number> = {};
  monthMaint.forEach((m) => { byItem[m.item] = (byItem[m.item] || 0) + m.value; });
  const sorted = [...maintenance].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Manutenção</Text>
        <View className="flex-row gap-2 mb-3">
          {(["year", "month"] as const).map((m) => (
            <TouchableOpacity key={m} onPress={() => setViewMode(m)}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: viewMode === m ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: viewMode === m ? colors.primary : colors.border,
              }}>
              <Text style={{ color: viewMode === m ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                {m === "year" ? "Anual" : "Mensal"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {viewMode === "year" ? (
          <>
            <DateNavigator label={`${year}`}
              onPrev={() => setRefDate(new Date(year - 1, refDate.getMonth()))}
              onNext={() => setRefDate(new Date(year + 1, refDate.getMonth()))} />
            <StatCard title="Total Anual" value={formatCurrency(totalAnual)} />
            {/* Gráfico sem R$ nos labels das barras */}
            <Card title="Gastos com Manutenção por Mês" className="mt-3 mb-4">
              <SimpleBarChart
                labels={monthNames}
                data={annualData}
                color="#F87171"
                showValues
                height={160}
                formatValue={(v) => v > 0 ? formatCurrency(v) : ""}
              />
            </Card>
          </>
        ) : (
          <>
            <DateNavigator label={formatMonthRange(refDate)}
              onPrev={() => setRefDate(shiftMonth(refDate, -1))}
              onNext={() => setRefDate(shiftMonth(refDate, 1))} />
            <StatCard title="Total do Mês" value={formatCurrency(monthMaint.reduce((s, m) => s + m.value, 0))} />
            {Object.keys(byItem).length > 0 && (
              <Card title="Por Item" className="mt-3 mb-4">
                <SimpleBarChart
                  labels={Object.keys(byItem)}
                  data={Object.values(byItem)}
                  barColors={["#F87171", "#EF4444", "#DC2626", "#FF6B6B", "#FF8A65"]}
                  showValues height={140}
                />
              </Card>
            )}
          </>
        )}

        <Text className="text-base font-bold text-foreground mt-2 mb-3">Novo Registro</Text>
        <Text className="text-xs text-muted mb-1 uppercase">Item</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
          {maintenanceCats.map((mi: string) => (
            <TouchableOpacity key={mi} onPress={() => setItem(mi)}
              style={{
                paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8,
                backgroundColor: item === mi ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: item === mi ? colors.primary : colors.border,
              }}>
              <Text style={{ color: item === mi ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 11 }}>{mi}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">KM Atual</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="0" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={kmVal} onChangeText={setKmVal} returnKeyType="done" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Valor (R$)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="0,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={value} onChangeText={setValue} returnKeyType="done" />
          </View>
        </View>

        {workshops.length > 0 && (
          <>
            <Text className="text-xs text-muted mb-1 uppercase">Oficina/Posto</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <TouchableOpacity onPress={() => setSelectedWorkshop("")}
                style={{
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8,
                  backgroundColor: selectedWorkshop === "" ? colors.primary : colors.surface,
                  borderWidth: 1, borderColor: selectedWorkshop === "" ? colors.primary : colors.border,
                }}>
                <Text style={{ color: selectedWorkshop === "" ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 11 }}>Outro</Text>
              </TouchableOpacity>
              {workshops.map((ws) => (
                <TouchableOpacity key={ws.id} onPress={() => { setSelectedWorkshop(ws.name); setLocation(ws.name); }}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8,
                    backgroundColor: selectedWorkshop === ws.name ? colors.primary : colors.surface,
                    borderWidth: 1, borderColor: selectedWorkshop === ws.name ? colors.primary : colors.border,
                  }}>
                  <Text style={{ color: selectedWorkshop === ws.name ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 11 }}>{ws.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Local</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="Oficina" placeholderTextColor={colors.muted}
              value={selectedWorkshop || location}
              onChangeText={(t) => { setLocation(t); setSelectedWorkshop(""); }} returnKeyType="done" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Data</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="DD/MM/AA" placeholderTextColor={colors.muted}
              value={date} onChangeText={setDate} returnKeyType="done" />
          </View>
        </View>

        <TouchableOpacity onPress={handleSave}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Salvar Manutenção</Text>
        </TouchableOpacity>

        <Text className="text-sm font-semibold text-muted mt-5 mb-2 uppercase">Últimos Registros</Text>
        {sorted.map((m) => (
          <View key={m.id} className="flex-row items-center bg-surface border border-border rounded-xl p-3 mb-2">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{m.item}</Text>
              <Text className="text-xs text-muted">{formatDate(m.date)} • {m.km}km{m.location ? ` • ${m.location}` : ""}</Text>
            </View>
            <Text className="text-base font-bold mr-3" style={{ color: colors.error }}>{formatCurrency(m.value)}</Text>
            <TouchableOpacity onPress={() => removeMaintenance(m.id)} style={{ padding: 4 }}>
              <IconSymbol name="trash.fill" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ==================== MÉDIA ====================
function MediaTab() {
  const { earnings, dailyKms, config } = useData();
  const colors = useColors();
  const [filterMode, setFilterMode] = useState<"weekly" | "monthly">("monthly");
  const [refDate, setRefDate] = useState(new Date());

  const start = filterMode === "weekly" ? getStartOfWeek(refDate) : getStartOfMonth(refDate);
  const end = filterMode === "weekly" ? getEndOfWeek(refDate) : getEndOfMonth(refDate);

  const periodEarnings = earnings.filter((e) => isInRange(e.date, start, end));
  const periodKms = dailyKms.filter((e) => isInRange(e.date, start, end));
  const totalEarnings = periodEarnings.reduce((s, e) => s + e.value, 0);
  const totalKm = periodKms.reduce((s, e) => s + e.km, 0);
  const daysWorked = new Set(periodEarnings.map((e) => e.date)).size || 1;
  const avgPerDay = totalEarnings / daysWorked;
  const avgKmPerDay = totalKm / daysWorked;
  const avgPerKm = totalKm > 0 ? totalEarnings / totalKm : 0;
  const costPerKmTotal = totalKm * config.costPerKm;
  const avgCostPerDay = costPerKmTotal / daysWorked;
  const netProfit = totalEarnings - costPerKmTotal;

  const navLabel = filterMode === "weekly" ? formatWeekRange(refDate) : formatMonthRange(refDate);
  const handlePrev = () => setRefDate(filterMode === "weekly" ? shiftWeek(refDate, -1) : shiftMonth(refDate, -1));
  const handleNext = () => setRefDate(filterMode === "weekly" ? shiftWeek(refDate, 1) : shiftMonth(refDate, 1));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Média</Text>
        <View className="flex-row gap-2 mb-3">
          {(["weekly", "monthly"] as const).map((mode) => (
            <TouchableOpacity key={mode} onPress={() => { setFilterMode(mode); setRefDate(new Date()); }}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: filterMode === mode ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: filterMode === mode ? colors.primary : colors.border,
              }}>
              <Text style={{ color: filterMode === mode ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                {mode === "weekly" ? "Semanal" : "Mensal"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <DateNavigator label={navLabel} onPrev={handlePrev} onNext={handleNext} />
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Média/Dia" value={formatCurrency(avgPerDay)} icon={<IconSymbol name="chart.bar.fill" size={16} color={colors.success} />} />
          <StatCard title="Média/KM" value={formatCurrency(avgPerKm)} icon={<IconSymbol name="speedometer" size={16} color={colors.primary} />} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="KM/Dia" value={`${avgKmPerDay.toFixed(1)} km`} icon={<IconSymbol name="location.fill" size={16} color={colors.warning} />} />
          <StatCard title="Dias Trabalhados" value={daysWorked.toString()} icon={<IconSymbol name="calendar" size={16} color={colors.muted} />} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Total Ganhos" value={formatCurrency(totalEarnings)} icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={colors.success} />} />
          <StatCard title="Total KM" value={`${totalKm.toFixed(0)} km`} icon={<IconSymbol name="speedometer" size={16} color={colors.primary} />} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Custo KM Total" value={formatCurrency(costPerKmTotal)} icon={<IconSymbol name="fuelpump.fill" size={16} color={colors.error} />} />
          <StatCard title="Custo/Dia" value={formatCurrency(avgCostPerDay)} icon={<IconSymbol name="clock.fill" size={16} color={colors.warning} />} />
        </View>
        <View className="flex-row gap-3 mb-4">
          <StatCard title="Lucro Líquido" value={formatCurrency(netProfit)} icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={netProfit >= 0 ? colors.success : colors.error} />} />
          <View className="flex-1" />
        </View>
        <Card title="Ganhos vs Custo KM" className="mb-4">
          <SimpleBarChart
            labels={["Ganhos", "Custo KM", "Lucro"]}
            data={[totalEarnings, costPerKmTotal, Math.max(0, netProfit)]}
            barColors={["#4ADE80", "#F87171", "#60A5FA"]}
            height={120} showValues
          />
        </Card>
      </View>
    </ScrollView>
  );
}

// ==================== PREVISÃO ====================
function PrevisaoTab() {
  const { forecasts, addForecast, removeForecast, config, saveConfig } = useData();
  const colors = useColors();
  const [dailyGoal, setDailyGoal] = useState((config.forecastConfig?.dailyGoal || 200).toString());
  const [valuePerKm, setValuePerKm] = useState(config.costPerKm.toString());
  const [daysPerWeek, setDaysPerWeek] = useState((config.forecastConfig?.workDaysPerWeek || 6).toString());
  const [itemName, setItemName] = useState("");
  const [itemCost, setItemCost] = useState("");
  const [itemKm, setItemKm] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config.forecastConfig) {
      if ((config.forecastConfig as any).dailyGoal) setDailyGoal((config.forecastConfig as any).dailyGoal.toString());
      if ((config.forecastConfig as any).valuePerKm) setValuePerKm((config.forecastConfig as any).valuePerKm.toString());
      if (config.forecastConfig.workDaysPerWeek) setDaysPerWeek(config.forecastConfig.workDaysPerWeek.toString());
    }
  }, []);

  const items = forecasts.map((f) => ({ name: f.item, unitCost: f.unitCost, kmDuration: f.kmDuration }));
  const result = calcFullForecast(
    parseFloat(dailyGoal.replace(",", ".")) || 0,
    parseFloat(valuePerKm.replace(",", ".")) || 0,
    parseInt(daysPerWeek) || 6,
    items
  );

  const handleSaveConfig = async () => {
    await saveConfig({
      forecastConfig: {
        ...config.forecastConfig,
        dailyGoal: parseFloat(dailyGoal.replace(",", ".")) || 200,
        valuePerKm: parseFloat(valuePerKm.replace(",", ".")) || config.costPerKm,
        workDaysPerWeek: parseInt(daysPerWeek) || 6,
      } as any,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    if (Platform.OS === "web") alert("Configurações salvas!"); else Alert.alert("Sucesso", "Configurações salvas!");
  };

  const handleAddItem = async () => {
    if (!itemName || !itemCost || !itemKm) {
      if (Platform.OS === "web") alert("Preencha todos os campos"); else Alert.alert("Atenção", "Preencha todos os campos");
      return;
    }
    await addForecast({
      item: itemName,
      unitCost: parseFloat(itemCost.replace(",", ".")),
      kmDuration: parseFloat(itemKm.replace(",", ".")),
    });
    setItemName(""); setItemCost(""); setItemKm("");
  };

  const lucroBrutoMensal = result.earningMonthly;
  const gastoKmMensal = result.kmPerMonth * result.realCostPerKm;
  const lucroLiquidoMensal = lucroBrutoMensal - result.totalMonthlyCost;
  const lucroBrutoAnual = result.earningAnnual;
  const lucroLiquidoAnual = lucroBrutoAnual - result.totalAnnualCost;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-4">Previsão</Text>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Lucro Bruto (Mês)" value={formatCurrency(lucroBrutoMensal)} icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={colors.success} />} />
          <StatCard title="Gasto KM (Mês)" value={formatCurrency(gastoKmMensal)} icon={<IconSymbol name="fuelpump.fill" size={16} color={colors.warning} />} />
        </View>
        <View className="flex-row gap-3 mb-3">
          <StatCard title="Lucro Líquido (Mês)" value={formatCurrency(lucroLiquidoMensal)} icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={lucroLiquidoMensal >= 0 ? colors.success : colors.error} />} />
          <StatCard title="Custo Real/KM" value={formatCurrency(result.realCostPerKm)} icon={<IconSymbol name="gauge.medium" size={16} color={colors.muted} />} />
        </View>
        <View className="flex-row gap-3 mb-4">
          <StatCard title="Lucro Bruto (Ano)" value={formatCurrency(lucroBrutoAnual)} icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={colors.success} />} />
          <StatCard title="Lucro Líquido (Ano)" value={formatCurrency(lucroLiquidoAnual)} icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={lucroLiquidoAnual >= 0 ? colors.success : colors.error} />} />
        </View>

        <Card title="Configuração" className="mb-4">
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Meta Diária (R$)</Text>
              <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                keyboardType="decimal-pad" value={dailyGoal} onChangeText={setDailyGoal} returnKeyType="done" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Valor/KM (R$)</Text>
              <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                keyboardType="decimal-pad" value={valuePerKm} onChangeText={setValuePerKm} returnKeyType="done" />
            </View>
          </View>
          <Text className="text-xs text-muted mb-1 uppercase">Dias por Semana</Text>
          <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground mb-3"
            keyboardType="number-pad" value={daysPerWeek} onChangeText={setDaysPerWeek} returnKeyType="done" />
          <TouchableOpacity onPress={handleSaveConfig}
            style={{ backgroundColor: saved ? colors.success : colors.primary, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{saved ? "Salvo!" : "Salvar Configurações"}</Text>
          </TouchableOpacity>
        </Card>

        <Card title="Projeção de KM" className="mb-4">
          {[["KM/Dia", `${result.kmPerDay.toFixed(1)} km`], ["KM/Semana", `${result.kmPerWeek.toFixed(1)} km`], ["KM/Mês", `${result.kmPerMonth.toFixed(0)} km`], ["KM/Ano", `${result.kmPerYear.toFixed(0)} km`]].map(([label, val]) => (
            <View key={label} className="flex-row justify-between items-center py-2">
              <Text className="text-sm text-muted">{label}</Text>
              <Text className="text-sm font-bold text-foreground">{val}</Text>
            </View>
          ))}
        </Card>

        <Card title="Projeção de Ganhos" className="mb-4">
          {[["Semanal", result.earningWeekly], ["Mensal", result.earningMonthly], ["Anual", result.earningAnnual]].map(([label, val]) => (
            <View key={label as string} className="flex-row justify-between items-center py-2">
              <Text className="text-sm text-muted">{label as string}</Text>
              <Text className="text-sm font-bold" style={{ color: colors.success }}>{formatCurrency(val as number)}</Text>
            </View>
          ))}
        </Card>

        <Card title="Projeção de Gastos" className="mb-4">
          {result.items.map((item, i) => (
            <View key={i} className="flex-row justify-between items-center py-2 border-b border-border/50">
              <Text className="text-sm text-foreground flex-1">{item.name}</Text>
              <Text className="text-sm text-muted mx-2">{Math.ceil(item.changesPerYear)}x/ano</Text>
              <Text className="text-sm font-bold" style={{ color: colors.error }}>{formatCurrency(Math.ceil(item.changesPerYear) * item.unitCost)}</Text>
            </View>
          ))}
          <View className="mt-3 pt-2 border-t border-border">
            {[["Gasto Anual Total", result.totalAnnualCost, colors.error], ["Gasto Mensal", result.totalMonthlyCost, colors.error], ["Custo Real/KM", result.realCostPerKm, colors.warning]].map(([label, val, color]) => (
              <View key={label as string} className="flex-row justify-between items-center py-1.5">
                <Text className="text-sm font-semibold text-foreground">{label as string}</Text>
                <Text className="text-sm font-bold" style={{ color: color as string }}>{formatCurrency(val as number)}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Text className="text-base font-bold text-foreground mb-3">Cadastrar Item</Text>
        <Text className="text-xs text-muted mb-1 uppercase">Nome</Text>
        <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground mb-3"
          placeholder="Ex: Pneu Traseiro" placeholderTextColor={colors.muted}
          value={itemName} onChangeText={setItemName} returnKeyType="done" />
        <View className="flex-row gap-3 mb-3">
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Valor Unitário</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="0,00" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={itemCost} onChangeText={setItemCost} returnKeyType="done" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted mb-1 uppercase">Durabilidade (KM)</Text>
            <TextInput className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground"
              placeholder="15000" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
              value={itemKm} onChangeText={setItemKm} returnKeyType="done" />
          </View>
        </View>
        <TouchableOpacity onPress={handleAddItem}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Adicionar Item</Text>
        </TouchableOpacity>

        <Text className="text-sm font-semibold text-muted mt-5 mb-2 uppercase">Itens Cadastrados</Text>
        {forecasts.map((f) => (
          <View key={f.id} className="flex-row items-center bg-surface border border-border rounded-xl p-3 mb-2">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{f.item}</Text>
              <Text className="text-xs text-muted">{formatCurrency(f.unitCost)} • troca a cada {f.kmDuration.toLocaleString()} km</Text>
            </View>
            <TouchableOpacity onPress={() => removeForecast(f.id)} style={{ padding: 4 }}>
              <IconSymbol name="trash.fill" size={16} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ==================== HORAS ====================
function HorasTab() {
  const { workShifts, addWorkShift, removeWorkShift, earnings } = useData();
  const colors = useColors();
  const [date, setDate] = useState(todayFormatted());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [refDate, setRefDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("week");

  const periodStart = viewMode === "week" ? getStartOfWeek(refDate) : getStartOfMonth(refDate);
  const periodEnd = viewMode === "week" ? getEndOfWeek(refDate) : getEndOfMonth(refDate);

  const periodShifts = workShifts.filter((s) => isInRange(s.date, periodStart, periodEnd));
  const totalMinutes = periodShifts.reduce((s, sh) => s + sh.durationMinutes, 0);
  const totalHours = totalMinutes / 60;

  const periodEarnings = earnings.filter((e) => isInRange(e.date, periodStart, periodEnd));
  const totalEarnings = periodEarnings.reduce((s, e) => s + e.value, 0);
  const reaisPerHora = totalHours > 0 ? totalEarnings / totalHours : 0;

  const navLabel = viewMode === "week" ? formatWeekRange(refDate) : formatMonthRange(refDate);
  const handlePrev = () => setRefDate(viewMode === "week" ? shiftWeek(refDate, -1) : shiftMonth(refDate, -1));
  const handleNext = () => setRefDate(viewMode === "week" ? shiftWeek(refDate, 1) : shiftMonth(refDate, 1));

  const calcDuration = (start: string, end: string): number => {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60; // turno que passa meia-noite
    return mins;
  };

  const handleSave = async () => {
    if (!startTime || !endTime) {
      if (Platform.OS === "web") alert("Preencha horário de saída e chegada");
      else Alert.alert("Atenção", "Preencha horário de saída e chegada");
      return;
    }
    const duration = calcDuration(startTime, endTime);
    if (duration <= 0) {
      if (Platform.OS === "web") alert("Horário inválido");
      else Alert.alert("Atenção", "Horário inválido");
      return;
    }
    await addWorkShift({
      date: parseDateInput(date),
      startTime,
      endTime,
      durationMinutes: duration,
    });
    setStartTime("");
    setEndTime("");
    if (Platform.OS === "web") alert("Turno registrado!");
    else Alert.alert("Sucesso", "Turno registrado!");
  };

  // Agrupa turnos por dia
  const shiftsByDay = useMemo(() => {
    const map: Record<string, typeof workShifts> = {};
    periodShifts.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [periodShifts]);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-3">Horas Trabalhadas</Text>

        <View className="flex-row gap-2 mb-3">
          {(["week", "month"] as const).map((mode) => (
            <TouchableOpacity key={mode} onPress={() => { setViewMode(mode); setRefDate(new Date()); }}
              style={{
                flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                backgroundColor: viewMode === mode ? colors.primary : colors.surface,
                borderWidth: 1, borderColor: viewMode === mode ? colors.primary : colors.border,
              }}>
              <Text style={{ color: viewMode === mode ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>
                {mode === "week" ? "Semana" : "Mês"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <DateNavigator label={navLabel} onPrev={handlePrev} onNext={handleNext} />

        <View className="flex-row gap-3 mb-3">
          <StatCard title="Horas Trabalhadas" value={`${totalHours.toFixed(1)}h`}
            icon={<IconSymbol name="clock.fill" size={16} color={colors.primary} />} />
          <StatCard title="R$/Hora" value={reaisPerHora > 0 ? formatCurrency(reaisPerHora) : "-"}
            icon={<IconSymbol name="dollarsign.circle.fill" size={16} color={colors.success} />} />
        </View>
        <View className="flex-row gap-3 mb-4">
          <StatCard title="Faturamento" value={formatCurrency(totalEarnings)}
            icon={<IconSymbol name="chart.line.uptrend.xyaxis" size={16} color={colors.success} />} />
          <StatCard title="Turnos" value={periodShifts.length.toString()}
            icon={<IconSymbol name="list.bullet" size={16} color={colors.muted} />} />
        </View>

        {/* Formulário de novo turno */}
        <Card title="Registrar Turno" className="mb-4">
          <Text className="text-xs text-muted mb-3">
            Registre cada vez que você sai para trabalhar. Pode ter vários turnos no mesmo dia.
          </Text>
          <Text className="text-xs text-muted mb-1 uppercase">Data</Text>
          <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-foreground mb-3"
            placeholder="DD/MM/AA" placeholderTextColor={colors.muted}
            value={date} onChangeText={setDate} returnKeyType="done" />
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Saída de Casa</Text>
              <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="08:00" placeholderTextColor={colors.muted}
                value={startTime} onChangeText={setStartTime} returnKeyType="done" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Chegada em Casa</Text>
              <TextInput className="bg-background border border-border rounded-xl px-4 py-3 text-foreground"
                placeholder="15:00" placeholderTextColor={colors.muted}
                value={endTime} onChangeText={setEndTime} returnKeyType="done" />
            </View>
          </View>
          {startTime && endTime && calcDuration(startTime, endTime) > 0 && (
            <View className="bg-background border border-border rounded-xl p-3 mb-3">
              <Text className="text-xs text-muted">
                Duração: {(calcDuration(startTime, endTime) / 60).toFixed(1)}h ({calcDuration(startTime, endTime)} min)
              </Text>
            </View>
          )}
          <TouchableOpacity onPress={handleSave}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Salvar Turno</Text>
          </TouchableOpacity>
        </Card>

        {/* Histórico agrupado por dia */}
        {shiftsByDay.length > 0 && (
          <>
            <Text className="text-sm font-semibold text-muted mb-2 uppercase">Histórico</Text>
            {shiftsByDay.map(([day, shifts]) => {
              const dayMinutes = shifts.reduce((s, sh) => s + sh.durationMinutes, 0);
              const dayHours = dayMinutes / 60;
              const dayEarnings = earnings
                .filter((e) => e.date === day)
                .reduce((s, e) => s + e.value, 0);
              const dayReaisPerHora = dayHours > 0 ? dayEarnings / dayHours : 0;

              return (
                <View key={day} className="bg-surface border border-border rounded-xl p-3 mb-3">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="text-sm font-bold text-foreground">{formatDate(day)}</Text>
                    <View className="items-end">
                      <Text className="text-xs font-bold" style={{ color: colors.primary }}>{dayHours.toFixed(1)}h total</Text>
                      {dayReaisPerHora > 0 && (
                        <Text className="text-xs text-muted">{formatCurrency(dayReaisPerHora)}/hora</Text>
                      )}
                    </View>
                  </View>
                  {shifts.map((s) => (
                    <View key={s.id} className="flex-row items-center py-1.5 border-t border-border/50">
                      <IconSymbol name="clock.fill" size={12} color={colors.muted} />
                      <Text className="text-xs text-foreground ml-2 flex-1">
                        {s.startTime} → {s.endTime} ({(s.durationMinutes / 60).toFixed(1)}h)
                      </Text>
                      <TouchableOpacity onPress={() => removeWorkShift(s.id)} style={{ padding: 4 }}>
                        <IconSymbol name="trash.fill" size={13} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              );
            })}
          </>
        )}
        {shiftsByDay.length === 0 && (
          <Text className="text-sm text-muted text-center py-4">Nenhum turno registrado no período</Text>
        )}
      </View>
    </ScrollView>
  );
}

// ==================== CONFIG ====================
function ConfigTab() {
  const { config, saveConfig, exportData, importData } = useData();
  const colors = useColors();
  const [costPerKm, setCostPerKm] = useState(config.costPerKm.toString());
  const [workDays, setWorkDays] = useState(config.workDaysPerWeek.toString());
  const [currentMotoKm, setCurrentMotoKm] = useState((config.currentMotoKm || 0).toString());
  const [weeklyGoalMode, setWeeklyGoalMode] = useState<"current" | "next">(config.weeklyGoalMode || "next");
  const [newApp, setNewApp] = useState("");
  const [paymentConfigs, setPaymentConfigs] = useState(config.appPaymentConfigs || []);
  const [workshops, setWorkshops] = useState(config.workshops || []);
  const [newWorkshopName, setNewWorkshopName] = useState("");
  const [newWorkshopAddress, setNewWorkshopAddress] = useState("");
  const [newWorkshopPhone, setNewWorkshopPhone] = useState("");
  const [newMaintenanceCategory, setNewMaintenanceCategory] = useState("");
  const colorOptions = ["#EA1D2C", "#FFCC00", "#FF6B00", "#F57C00", "#00B0FF", "#06C167", "#2ECC40", "#000000", "#9C27B0", "#E91E63", "#3F51B5", "#009688", "#795548", "#607D8B"];

  const handleSave = async () => {
    await saveConfig({
      costPerKm: parseFloat(costPerKm.replace(",", ".")) || 0.35,
      workDaysPerWeek: parseInt(workDays) || 5,
      currentMotoKm: parseFloat(currentMotoKm.replace(",", ".")) || 0,
      weeklyGoalMode,
      appPaymentConfigs: paymentConfigs,
      workshops: workshops,
      maintenanceCategories: config.maintenanceCategories || config.maintenanceItems,
    });
    if (Platform.OS === "web") alert("Configurações salvas!"); else Alert.alert("Sucesso", "Configurações salvas!");
  };

  const handleAddMaintenanceCategory = async () => {
    if (!newMaintenanceCategory.trim()) return;
    const cats = [...(config.maintenanceCategories || config.maintenanceItems || []), newMaintenanceCategory.trim()];
    await saveConfig({ maintenanceCategories: cats, maintenanceItems: cats });
    setNewMaintenanceCategory("");
  };

  const handleRemoveMaintenanceCategory = async (cat: string) => {
    const doRemove = async () => {
      const cats = (config.maintenanceCategories || config.maintenanceItems || []).filter((c: string) => c !== cat);
      await saveConfig({ maintenanceCategories: cats, maintenanceItems: cats });
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

  const handleSetAppColor = async (appName: string, color: string) => {
    const appColors = { ...(config.appColors || {}), [appName]: color };
    await saveConfig({ appColors });
  };

  const handleAddApp = async () => {
    if (!newApp.trim()) return;
    await saveConfig({ apps: [...config.apps, newApp.trim()] });
    setNewApp("");
  };

  const handleRemoveApp = async (app: string) => {
    await saveConfig({ apps: config.apps.filter((a) => a !== app) });
  };

  const handleAddWorkshop = () => {
    if (!newWorkshopName.trim()) {
      if (Platform.OS === "web") alert("Preencha o nome do local"); else Alert.alert("Atenção", "Preencha o nome do local");
      return;
    }
    const newWs = { id: `ws_${Date.now()}`, name: newWorkshopName.trim(), address: newWorkshopAddress.trim() || undefined, phone: newWorkshopPhone.trim() || undefined, createdAt: new Date().toISOString() };
    setWorkshops([...workshops, newWs]);
    setNewWorkshopName(""); setNewWorkshopAddress(""); setNewWorkshopPhone("");
  };

  const handleRemoveWorkshop = (id: string) => { setWorkshops(workshops.filter((w) => w.id !== id)); };

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
        alert("Dados exportados!");
      } else {
        await Share.share({ message: data, title: "MotoControle Backup" });
      }
    } catch (err) {
      if (Platform.OS === "web") alert("Erro ao exportar"); else Alert.alert("Erro", "Falha ao exportar");
    }
  };

  const handleImport = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file"; input.accept = ".json";
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const success = await importData(text);
        if (success) alert("Dados importados!"); else alert("Erro: arquivo inválido");
      };
      input.click();
    } else {
      Alert.alert("Importar", "Para importar dados, use a opção de restauração no Dashboard.");
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="px-5 pt-2">
        <Text className="text-lg font-bold text-foreground mb-4">Configurações</Text>

        <Card title="Backup de Dados" className="mb-4">
          <Text className="text-xs text-muted mb-3">Exporte seus dados para backup ou importe de um backup anterior.</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity onPress={handleExport}
              style={{ flex: 1, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Exportar Dados</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleImport}
              style={{ flex: 1, backgroundColor: colors.success, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Importar Dados</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card title="Geral" className="mb-4">
          <View className="flex-row gap-3 mb-3">
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Custo/KM (R$)</Text>
              <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                keyboardType="decimal-pad" value={costPerKm} onChangeText={setCostPerKm} returnKeyType="done" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Dias de Trabalho</Text>
              <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                keyboardType="number-pad" value={workDays} onChangeText={setWorkDays} returnKeyType="done" />
            </View>
          </View>

          {/* KM Atual da Moto */}
          <Text className="text-xs text-muted mb-1 uppercase">KM Atual da Moto (Odômetro)</Text>
          <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground mb-3"
            placeholder="Ex: 25000" placeholderTextColor={colors.muted} keyboardType="decimal-pad"
            value={currentMotoKm} onChangeText={setCurrentMotoKm} returnKeyType="done" />
          <Text className="text-xs text-muted mb-3">Usado para alertas automáticos de manutenção baseados em KM.</Text>

          {/* Meta Semanal */}
          <Text className="text-xs text-muted mb-2 uppercase">Cálculo da Meta Semanal</Text>
          <View className="flex-row gap-2 mb-3">
            {(["current", "next"] as const).map((mode) => (
              <TouchableOpacity key={mode} onPress={() => setWeeklyGoalMode(mode)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center",
                  backgroundColor: weeklyGoalMode === mode ? colors.primary : colors.surface,
                  borderWidth: 1, borderColor: weeklyGoalMode === mode ? colors.primary : colors.border,
                }}>
                <Text style={{ color: weeklyGoalMode === mode ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                  {mode === "current" ? "Semana Atual" : "Próxima Semana"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text className="text-xs text-muted">
            {weeklyGoalMode === "current"
              ? "A meta mostra quanto você precisa fazer esta semana para pagar as contas desta semana."
              : "A meta mostra quanto você precisa fazer esta semana para pagar as contas da próxima semana."}
          </Text>
        </Card>

        <Card title="Meus Locais" className="mb-4">
          <Text className="text-xs text-muted mb-3">Cadastre oficinas mecânicas e postos de gasolina</Text>
          {workshops.map((ws) => (
            <View key={ws.id} className="flex-row items-center bg-background border border-border rounded-xl p-3 mb-2">
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground">{ws.name}</Text>
                {ws.address && <Text className="text-xs text-muted">{ws.address}</Text>}
                {ws.phone && <Text className="text-xs text-muted">{ws.phone}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleRemoveWorkshop(ws.id)} style={{ padding: 4 }}>
                <IconSymbol name="trash.fill" size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          <Text className="text-xs text-muted mb-1 uppercase mt-2">Nome</Text>
          <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground mb-2"
            placeholder="Ex: Oficina do João" placeholderTextColor={colors.muted}
            value={newWorkshopName} onChangeText={setNewWorkshopName} returnKeyType="done" />
          <View className="flex-row gap-2 mb-2">
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Endereço</Text>
              <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                placeholder="Opcional" placeholderTextColor={colors.muted}
                value={newWorkshopAddress} onChangeText={setNewWorkshopAddress} returnKeyType="done" />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted mb-1 uppercase">Telefone</Text>
              <TextInput className="bg-background border border-border rounded-xl px-3 py-2 text-foreground"
                placeholder="Opcional" placeholderTextColor={colors.muted}
                value={newWorkshopPhone} onChangeText={setNewWorkshopPhone} returnKeyType="done" />
            </View>
          </View>
          <TouchableOpacity onPress={handleAddWorkshop}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Adicionar Local</Text>
          </TouchableOpacity>
        </Card>

        <Card title="Categorias de Manutenção" className="mb-4">
          <Text className="text-xs text-muted mb-3">Gerencie as categorias de manutenção da sua moto</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {(config.maintenanceCategories || config.maintenanceItems || []).map((cat: string) => (
              <View key={cat} className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-2">
                <Text className="text-xs text-foreground mr-2">{cat}</Text>
                <TouchableOpacity onPress={() => handleRemoveMaintenanceCategory(cat)}>
                  <Text style={{ color: colors.error, fontSize: 14 }}>x</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View className="flex-row gap-2">
            <TextInput className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground"
              placeholder="Nova categoria" placeholderTextColor={colors.muted}
              value={newMaintenanceCategory} onChangeText={setNewMaintenanceCategory} returnKeyType="done" />
            <TouchableOpacity onPress={handleAddMaintenanceCategory}
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>+ Adicionar</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card title="Cores dos Aplicativos" className="mb-4">
          <Text className="text-xs text-muted mb-3">Personalize a cor de cada aplicativo nos gráficos</Text>
          {config.apps.map((app: string) => {
            const currentColor = (config.appColors || {})[app] || getAppColor(app);
            return (
              <View key={app} className="flex-row items-center mb-2">
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: currentColor, marginRight: 8 }} />
                <Text className="text-sm text-foreground flex-1">{app}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: 200 }}>
                  {colorOptions.map((c: string) => (
                    <TouchableOpacity key={c} onPress={() => handleSetAppColor(app, c)}
                      style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c, marginRight: 4, borderWidth: currentColor === c ? 2 : 0, borderColor: "#fff" }} />
                  ))}
                </ScrollView>
              </View>
            );
          })}
        </Card>

        <Card title="Aplicativos" className="mb-4">
          <Text className="text-xs text-muted mb-3">Gerencie seus aplicativos de entrega</Text>
          <View className="flex-row flex-wrap gap-2 mb-3">
            {config.apps.map((app) => (
              <View key={app} className="flex-row items-center bg-surface border border-border rounded-xl px-3 py-2">
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: getAppColor(app), marginRight: 6 }} />
                <Text className="text-xs text-foreground mr-2">{app}</Text>
                <TouchableOpacity onPress={() => handleRemoveApp(app)}>
                  <Text style={{ color: colors.error, fontSize: 14 }}>x</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View className="flex-row gap-2">
            <TextInput className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground"
              placeholder="Nome do novo app" placeholderTextColor={colors.muted}
              value={newApp} onChangeText={setNewApp} returnKeyType="done" />
            <TouchableOpacity onPress={handleAddApp}
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>+ Adicionar</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <TouchableOpacity onPress={handleSave}
          style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Salvar Configurações</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
