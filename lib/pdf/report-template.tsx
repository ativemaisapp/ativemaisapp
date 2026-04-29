import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

// ── Cores da paleta Ative+60 ──
const C = {
  verde: "#7C9885",
  laranja: "#D9824B",
  creme: "#F5F1EA",
  tinta: "#1C2A24",
  cinza: "#6B7B73",
  ambar: "#C68A3F",
  linha: "#E5E0D5",
  white: "#FFFFFF",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.tinta,
    lineHeight: 1.4,
    display: "flex" as const,
    flexDirection: "column" as const,
  },
  // Header
  logoWrap: { alignItems: "center", marginBottom: 8 },
  hrGreen: { height: 1, backgroundColor: C.verde, marginVertical: 8 },
  hrGray: { height: 1, backgroundColor: C.linha, marginVertical: 8 },
  titleCenter: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: C.verde,
    textAlign: "center",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 11,
    color: C.cinza,
    textAlign: "center",
    marginTop: 2,
  },
  // Identification
  row: { flexDirection: "row", gap: 20 },
  col: { flex: 1 },
  label: {
    fontSize: 8,
    color: C.cinza,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  value: { fontSize: 10, color: C.tinta, marginBottom: 6 },
  // Summary cards
  cardsRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 12,
  },
  card: {
    flex: 1,
    backgroundColor: C.creme,
    borderWidth: 1,
    borderColor: C.linha,
    borderRadius: 4,
    padding: 8,
    alignItems: "center",
  },
  cardNumber: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: C.tinta,
  },
  cardLabel: {
    fontSize: 7,
    color: C.cinza,
    textTransform: "uppercase",
    marginTop: 2,
    textAlign: "center",
  },
  // Section title
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.verde,
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  // Conducts table
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.linha, paddingVertical: 4 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.verde, paddingVertical: 4 },
  tableCell: { fontSize: 9, color: C.tinta },
  tableCellHead: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.cinza, textTransform: "uppercase" },
  // Sessions table
  sessionRowEven: { flexDirection: "row", paddingVertical: 3, backgroundColor: C.creme },
  sessionRowOdd: { flexDirection: "row", paddingVertical: 3 },
  // Footer
  footer: {
    marginTop: "auto" as unknown as number,
    paddingTop: 10,
  },
  footerLine: { height: 1.5, backgroundColor: C.verde, marginBottom: 8 },
  footerRow: { flexDirection: "row" as const, justifyContent: "space-between" as const },
  footerCol: { alignItems: "center" as const },
  footerText: { fontSize: 8, color: C.cinza },
  footerBold: { fontSize: 8, color: C.tinta, fontFamily: "Helvetica-Bold" },
  pageNumber: { fontSize: 7, color: C.cinza, textAlign: "center" as const, marginTop: 6 },
  // Narrative
  narrative: { fontSize: 10, color: C.tinta, lineHeight: 1.5, textAlign: "justify" },
  // Attention
  attentionText: { fontSize: 9, color: C.ambar, marginBottom: 3 },
});

// ── Tipos ──
export type ReportData = {
  patient: {
    fullName: string;
    birthDate: string;
    age: number;
    diagnosis: string;
    frequency: number;
    timeInPortfolio: string;
  };
  fisio: {
    fullName: string;
    crefito: string;
  };
  month: string; // "Outubro de 2026"
  summary: {
    completed: number;
    total: number;
    avgBpSys: number;
    avgBpDia: number;
    avgHr: number;
    intercurrences: number;
  };
  narrative: string;
  conducts: Array<{ name: string; count: number }>;
  attentionItems: Array<{ date: string; description: string }>;
  sessions: Array<{
    date: string;
    fisioName: string;
    bpInitial: string;
    bpFinal: string;
    hrInitial: string;
    hrFinal: string;
    spo2: string;
    conducts: string;
    hadIntercurrence: boolean;
  }>;
};

// ── Componente do documento ──
export function ReportDocument({ data }: { data: ReportData }) {
  const d = data;

  return (
    <Document>
      {/* PÁGINA 1 */}
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.logoWrap}>
          <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: C.verde, letterSpacing: 2 }}>
            a t i v e
            <Text style={{ color: C.laranja }}> + 60</Text>
          </Text>
          <Text style={{ fontSize: 7, color: C.cinza, letterSpacing: 1.5, marginTop: 2, textTransform: "uppercase" }}>
            fisioterapia para idosos
          </Text>
        </View>

        <View style={s.hrGreen} />

        <Text style={s.titleCenter}>RELATÓRIO MENSAL DE FISIOTERAPIA</Text>
        <Text style={s.subtitle}>Mês de {d.month}</Text>

        <View style={s.hrGray} />

        {/* Identificação */}
        <View style={s.row}>
          <View style={s.col}>
            <Text style={s.label}>Paciente</Text>
            <Text style={s.value}>{d.patient.fullName}</Text>
            <Text style={s.label}>Data de nascimento</Text>
            <Text style={s.value}>
              {d.patient.birthDate} ({d.patient.age} anos)
            </Text>
            <Text style={s.label}>Diagnóstico principal</Text>
            <Text style={s.value}>{d.patient.diagnosis}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>Fisioterapeuta responsável</Text>
            <Text style={s.value}>
              {d.fisio.fullName} — CREFITO {d.fisio.crefito}
            </Text>
            <Text style={s.label}>Frequência contratada</Text>
            <Text style={s.value}>
              {d.patient.frequency} sessões por semana
            </Text>
            <Text style={s.label}>Tempo na carteira</Text>
            <Text style={s.value}>{d.patient.timeInPortfolio}</Text>
          </View>
        </View>

        {/* Cards de resumo */}
        <View style={s.cardsRow}>
          <View style={s.card}>
            <Text style={s.cardNumber}>{d.summary.completed}</Text>
            <Text style={s.cardLabel}>
              atendimentos{"\n"}de {d.summary.total} previstos
            </Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardNumber}>
              {d.summary.avgBpSys}x{d.summary.avgBpDia}
            </Text>
            <Text style={s.cardLabel}>PA média{"\n"}mmHg</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardNumber}>{d.summary.avgHr}</Text>
            <Text style={s.cardLabel}>FC média{"\n"}bpm</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardNumber}>{d.summary.intercurrences}</Text>
            <Text style={s.cardLabel}>
              intercorrências{"\n"}reportadas
            </Text>
          </View>
        </View>

        {/* Evolução clínica */}
        <Text style={s.sectionTitle}>Evolução Clínica</Text>
        <Text style={s.narrative}>{d.narrative}</Text>

        {/* Condutas */}
        <Text style={s.sectionTitle}>Condutas Aplicadas</Text>
        <View style={s.tableHead}>
          <Text style={[s.tableCellHead, { flex: 3 }]}>Conduta</Text>
          <Text style={[s.tableCellHead, { flex: 1, textAlign: "right" }]}>
            Sessões
          </Text>
        </View>
        {d.conducts.slice(0, 8).map((c, i) => (
          <View key={i} style={s.tableRow}>
            <Text style={[s.tableCell, { flex: 3 }]}>{c.name}</Text>
            <Text style={[s.tableCell, { flex: 1, textAlign: "right" }]}>
              {c.count}
            </Text>
          </View>
        ))}

        <View style={s.footer}>
          <View style={s.footerLine} />
          <View style={s.footerRow}>
            <View style={s.footerCol}>
              <Text style={s.footerBold}>Amanda Cardoso</Text>
              <Text style={s.footerText}>CREFITO 171522-F</Text>
              <Text style={s.footerText}>(83) 98660-2903</Text>
            </View>
            <View style={s.footerCol}>
              <Text style={s.footerBold}>Ative+60</Text>
              <Text style={s.footerText}>Fisioterapia para idosos</Text>
              <Text style={s.footerText}>@ativemais60fisioterapia</Text>
            </View>
            <View style={s.footerCol}>
              <Text style={s.footerBold}>Rayanne Paiva</Text>
              <Text style={s.footerText}>CREFITO 176945-F</Text>
              <Text style={s.footerText}>(83) 99999-0954</Text>
            </View>
          </View>
          <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>

      {/* PÁGINA 2+ — Pontos de atenção + Detalhamento */}
      {(d.sessions.length >= 3 || d.attentionItems.length > 0) && (
        <Page size="A4" style={s.page}>
          {/* Pontos de atenção */}
          {d.attentionItems.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={s.sectionTitle}>Pontos de Atenção</Text>
              {d.attentionItems.map((item, i) => (
                <Text key={i} style={s.attentionText}>
                  {item.date}: {item.description}
                </Text>
              ))}
            </View>
          )}

          {d.sessions.length >= 3 && (
            <Text style={s.sectionTitle}>Detalhamento das Sessões</Text>
          )}

          {d.sessions.length >= 3 && (
            <>
              <View style={s.tableHead}>
                <Text style={[s.tableCellHead, { width: 55 }]}>Data</Text>
                <Text style={[s.tableCellHead, { width: 65 }]}>Fisio</Text>
                <Text style={[s.tableCellHead, { width: 70 }]}>PA</Text>
                <Text style={[s.tableCellHead, { width: 55 }]}>FC</Text>
                <Text style={[s.tableCellHead, { width: 35 }]}>SpO2</Text>
                <Text style={[s.tableCellHead, { flex: 1 }]}>Condutas</Text>
              </View>
              {d.sessions.map((sess, i) => (
                <View
                  key={i}
                  style={i % 2 === 0 ? s.sessionRowEven : s.sessionRowOdd}
                >
                  <Text style={[s.tableCell, { width: 55 }]}>{sess.date}</Text>
                  <Text style={[s.tableCell, { width: 65, fontSize: 8 }]}>
                    {sess.fisioName}
                  </Text>
                  <Text style={[s.tableCell, { width: 70, fontSize: 8 }]}>
                    {sess.bpInitial} &gt; {sess.bpFinal}
                  </Text>
                  <Text style={[s.tableCell, { width: 55, fontSize: 8 }]}>
                    {sess.hrInitial} &gt; {sess.hrFinal}
                  </Text>
                  <Text style={[s.tableCell, { width: 35, fontSize: 8 }]}>
                    {sess.spo2}
                  </Text>
                  <Text style={[s.tableCell, { flex: 1, fontSize: 7 }]}>
                    {sess.conducts}
                    {sess.hadIntercurrence ? " (!)" : ""}
                  </Text>
                </View>
              ))}
            </>
          )}

          <View style={s.footer}>
            <View style={s.footerLine} />
            <View style={s.footerRow}>
              <View style={s.footerCol}>
                <Text style={s.footerBold}>Amanda Cardoso</Text>
                <Text style={s.footerText}>CREFITO 171522-F</Text>
                <Text style={s.footerText}>(83) 98660-2903</Text>
              </View>
              <View style={s.footerCol}>
                <Text style={s.footerBold}>Ative+60</Text>
                <Text style={s.footerText}>Fisioterapia para idosos</Text>
                <Text style={s.footerText}>@ativemais60fisioterapia</Text>
              </View>
              <View style={s.footerCol}>
                <Text style={s.footerBold}>Rayanne Paiva</Text>
                <Text style={s.footerText}>CREFITO 176945-F</Text>
                <Text style={s.footerText}>(83) 99999-0954</Text>
              </View>
            </View>
            <Text style={s.pageNumber} render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} de ${totalPages}`} />
          </View>
        </Page>
      )}
    </Document>
  );
}

