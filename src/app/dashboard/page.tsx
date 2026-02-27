
import { WbsChart } from "@/components/WbsChart";
import { ResourceGauges } from "@/components/ResourceGauges";

export default function DashboardPage() {
  return (
    <main>
      <header>
        <h1>ダッシュボード</h1>
      </header>
      
      <section>
        <h2>リソース状況</h2>
        <ResourceGauges />
      </section>
      
      <section>
        <h2>WBS</h2>
        <WbsChart />
      </section>

    </main>
  );
}
