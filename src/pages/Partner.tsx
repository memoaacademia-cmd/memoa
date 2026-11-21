import { PageHead } from '../components/ui'
import PartnerSection from '../components/PartnerSection'

/** Page « Programme partenaire » : ouverte depuis la ligne du même nom dans Moi. */
export default function Partner() {
  return (
    <main className="page partner-page" style={{ gap: 18 }}>
      <PageHead to="/moi" title="Programme partenaire" />
      <PartnerSection />
    </main>
  )
}
