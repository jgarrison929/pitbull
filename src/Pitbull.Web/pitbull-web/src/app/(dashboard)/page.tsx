"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  {
    title: "Active Projects",
    value: "12",
    description: "3 starting this month",
    icon: "🏗️",
  },
  {
    title: "Open Bids",
    value: "8",
    description: "2 due this week",
    icon: "📋",
  },
  {
    title: "Pending Change Orders",
    value: "5",
    description: "$127K total value",
    icon: "📝",
  },
  {
    title: "Monthly Revenue",
    value: "$2.4M",
    description: "+12% from last month",
    icon: "💰",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back. Here&apos;s your project overview.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <span className="text-xl">{stat.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { text: "Bid #B-2024-015 submitted for Downtown Office Complex", time: "2 hours ago" },
              { text: "Change order approved on Project #P-2024-008", time: "5 hours ago" },
              { text: "New RFI received on Riverside Apartments", time: "Yesterday" },
              { text: "Project #P-2024-012 milestone completed", time: "Yesterday" },
            ].map((activity, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="mt-1 h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                <div className="flex-1">
                  <p>{activity.text}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
