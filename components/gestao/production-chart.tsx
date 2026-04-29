"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

type FisioProduction = {
  name: string;
  count: number;
  revenue: number;
};

type Props = {
  data: FisioProduction[];
};

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: FisioProduction }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-linha-suave bg-white px-3 py-2 shadow-sm">
      <p className="text-sm font-medium text-tinta-texto">{d.name}</p>
      <p className="text-xs text-cinza-texto">
        {d.count} {d.count === 1 ? "atendimento" : "atendimentos"}
      </p>
      <p className="text-xs text-cinza-texto">
        Receita: {formatCurrency(d.revenue)}
      </p>
    </div>
  );
}

export function ProductionChart({ data }: Props) {
  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-cinza-texto">
        Sem dados neste período.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={data.length * 48 + 20}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 13, fill: "#6B7B73" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F5F1EA" }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={24}>
          {data.map((_, i) => (
            <Cell key={i} fill="#7C9885" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
