from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.style import WD_STYLE_TYPE
from pathlib import Path

ROOT = Path('/Users/nishanth/Documents/code/personal projects/Tuition Ai/TuitionAI/frontend')
BLUE = '17365D'
TEAL = '0F6B78'
PALE = 'F3F7FB'
PALE_TEAL = 'EAF6F7'
GREY = 'D9E2F3'
MID_GREY = '6B7280'
RED = '8B2D3B'


def set_cell_shading(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = tcPr.find(qn('w:shd'))
    if shd is None:
        shd = OxmlElement('w:shd')
        tcPr.append(shd)
    shd.set(qn('w:fill'), fill)


def set_cell_borders(cell, color=GREY):
    tcPr = cell._tc.get_or_add_tcPr()
    borders = tcPr.first_child_found_in('w:tcBorders')
    if borders is None:
        borders = OxmlElement('w:tcBorders')
        tcPr.append(borders)
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = borders.find(qn('w:' + edge))
        if el is None:
            el = OxmlElement('w:' + edge)
            borders.append(el)
        el.set(qn('w:val'), 'single')
        el.set(qn('w:sz'), '6')
        el.set(qn('w:color'), color)


def set_cell_margins(cell, top=80, start=95, bottom=80, end=95):
    tcPr = cell._tc.get_or_add_tcPr()
    mar = tcPr.first_child_found_in('w:tcMar')
    if mar is None:
        mar = OxmlElement('w:tcMar')
        tcPr.append(mar)
    for side, val in [('top', top), ('start', start), ('bottom', bottom), ('end', end)]:
        el = mar.find(qn('w:' + side))
        if el is None:
            el = OxmlElement('w:' + side)
            mar.append(el)
        el.set(qn('w:w'), str(val))
        el.set(qn('w:type'), 'dxa')


def repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement('w:tblHeader')
    el.set(qn('w:val'), 'true')
    trPr.append(el)


def do_not_split_row(row):
    trPr = row._tr.get_or_add_trPr()
    el = OxmlElement('w:cantSplit')
    trPr.append(el)


def keep_with_next(paragraph):
    paragraph.paragraph_format.keep_with_next = True


class VCDoc:
    def __init__(self, title, subtitle, footer):
        self.doc = Document()
        section = self.doc.sections[0]
        section.page_width, section.page_height = Inches(8.5), Inches(11)
        section.top_margin = section.bottom_margin = Inches(0.62)
        section.left_margin = section.right_margin = Inches(0.68)
        for name, size, font in [('Normal', 10.2, 'Aptos'), ('Title', 25, 'Aptos Display'),
                                 ('Heading 1', 17, 'Aptos Display'), ('Heading 2', 13, 'Aptos Display'),
                                 ('Heading 3', 11, 'Aptos')]:
            style = self.doc.styles[name]
            style.font.name = font
            style.font.size = Pt(size)
            style.font.color.rgb = RGBColor.from_string(BLUE if name != 'Normal' else '222222')
            if name != 'Normal':
                style.font.bold = True
            style.paragraph_format.space_after = Pt(5)
            style.paragraph_format.space_before = Pt(10 if name not in ('Normal', 'Title') else 0)
        self.doc.styles['Normal'].paragraph_format.line_spacing = 1.07
        self.doc.styles['Normal'].paragraph_format.widow_control = True
        footer_p = section.footer.paragraphs[0]
        footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = footer_p.add_run(footer)
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor.from_string(MID_GREY)
        self.title = title
        self.subtitle = subtitle

    def p(self, text='', style=None, bold_prefix=None):
        p = self.doc.add_paragraph(style=style)
        if bold_prefix and text.startswith(bold_prefix):
            p.add_run(bold_prefix).bold = True
            p.add_run(text[len(bold_prefix):])
        else:
            p.add_run(text)
        return p

    def bullet(self, text):
        p = self.doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(2)
        p.add_run(text)
        return p

    def h(self, text, level=1):
        p = self.doc.add_heading(text, level)
        keep_with_next(p)
        return p

    def page_break(self):
        self.doc.add_page_break()

    def title_page(self):
        p = self.doc.add_paragraph(style='Title')
        p.paragraph_format.space_after = Pt(3)
        p.add_run(self.title)
        p = self.doc.add_paragraph()
        r = p.add_run(self.subtitle)
        r.bold = True
        r.font.size = Pt(13)
        r.font.color.rgb = RGBColor.from_string(TEAL)
        self.p('Prepared for Start It NUS Club  |  Google Docs-ready working document')

    def table(self, headers, rows, widths=None, fs=8.4, header_fill=BLUE):
        t = self.doc.add_table(rows=1, cols=len(headers))
        t.alignment = WD_TABLE_ALIGNMENT.CENTER
        t.autofit = False
        repeat_header(t.rows[0])
        do_not_split_row(t.rows[0])
        for i, value in enumerate(headers):
            c = t.rows[0].cells[i]
            c.text = str(value)
            set_cell_shading(c, header_fill)
            set_cell_borders(c)
            set_cell_margins(c)
            c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for p in c.paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p.paragraph_format.space_after = Pt(1)
                for r in p.runs:
                    r.font.bold = True
                    r.font.color.rgb = RGBColor(255, 255, 255)
                    r.font.size = Pt(fs)
        for ridx, rowdata in enumerate(rows):
            row = t.add_row()
            do_not_split_row(row)
            for i, value in enumerate(rowdata):
                c = row.cells[i]
                c.text = str(value)
                set_cell_shading(c, PALE if ridx % 2 else 'FFFFFF')
                set_cell_borders(c)
                set_cell_margins(c)
                c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
                for p in c.paragraphs:
                    p.paragraph_format.space_after = Pt(1)
                    for r in p.runs:
                        r.font.size = Pt(fs)
        if widths:
            for row in t.rows:
                for c, w in zip(row.cells, widths):
                    c.width = Inches(w)
        self.doc.add_paragraph().paragraph_format.space_after = Pt(1)
        return t

    def save(self, path):
        self.doc.save(path)


def add_source_table(d):
    d.h('Research basis for the facilitator', 1)
    d.p('Use these sources to verify the real-company reveal. The participant handout should contain only the anonymised profiles and event cards.')
    rows = [
        ['Project Signal / PatSnap', 'Company media and NUS profile', 'patsnap.com/media/  |  comp.nus.edu.sg/news-media/2021-billion-dollar-league-patsnap/'],
        ['Project Motor / Carro', 'Carro financing and profitability updates', 'news.carsome.com/news/item/carsome-raises-us200-million-in-financing-round-brings-valuation-to-us1-3-billion  |  news.carsome.com/news/carsome-completes-its-latest-financing-round-upon-achieving-operational-profitability'],
        ['Project Loom / Zilingo', 'Business Times and Euronews reporting', 'businesstimes.com.sg/startups-tech/temasek-backed-zilingo-liquidate-after-crisis-fashion-startup  |  euronews.com/next/2022/05/20/zilingo-ceo'],
        ['Project Hive / honestbee', 'Singapore High Court judgment', 'elitigation.sg/gd/s/2021_SGHC_166'],
        ['Project Route / Airlift', 'TechCrunch, Rest of World and Dawn reporting', 'techcrunch.com/2022/07/12/airlift-shutdown/  |  restofworld.org/2022/pakistans-airlift-officially-shuts-down/'],
        ['Project Wallet / M-KOPA', 'M-KOPA newsroom and TechCrunch', 'm-kopa.com/newsroom/m-kopa-raises-over-250m-in-new-financing  |  m-kopa.com/newsroom/m-kopa-hits-3-million-active-customers-milestone'],
        ['Project MedAir / Zipline', 'Zipline newsroom', 'zipline.com/newsroom/zipline-surpasses-2-million-deliveries-raises-more-than-600m-to-power-next-phase-of-growth-and-expands-operations-to-houston-and-phoenix'],
        ['Project Social / Koo', 'TechCrunch reporting', 'techcrunch.com/2024/07/02/indian-social-network-koo-to-shut-down/'],
    ]
    d.table(['Code name / real company', 'Source type', 'Reference'], rows, [1.65, 1.55, 3.95], 7.1)
    d.p('Facilitator note: the game uses real company journeys but fictionalises the code names, private facts, event wording and investment returns. Avoid presenting allegations about any real company as proven fact; describe public reporting neutrally.')


def build_flow():
    d = VCDoc('VC Time Machine: Event Flow', 'The participant and facilitator run-of-show for an 8-company, 6-sector VC game night', 'VC Time Machine  |  Start It NUS Club  |  Event Flow')
    d.title_page()
    d.h('Before participants arrive')
    d.table(['Prepare', 'Quantity / owner'], [
        ['Team fund sheets and pens', 'One per fund; facilitator'],
        ['Quiz slides or printed quiz', '10 questions; quiz host'],
        ['Anonymised company profiles', 'One set per fund'],
        ['Funding-round decision sheets', 'Pre-Series A, Series A and Series B; one set per fund'],
        ['Private Company Confidential cards', '8 cards; host keeps them hidden'],
        ['Six sector event cards and one global event card', 'Host keeps sealed until the correct round'],
        ['Final reveal slides', 'Real names, actual outcomes, facts and scoring'],
    ], [4.8, 2.35], 8.6)
    d.h('Quick rules')
    for x in [
        'Participants play in teams. Each team is a fictional VC fund; the fund, not an individual, wins the main game.',
        'Each fund starts with 100 investment credits and may invest 0–20 credits in a company at each round.',
        'The event has three rounds: Pre-Series A, Series A and Series B. Earlier rounds offer more upside; later rounds offer more information but lower upside.',
        'Company identities, real outcomes and all facilitator-only information stay hidden until every final decision is submitted.',
        'The host should call every event a “signal” or “turning point,” never a direct prediction of success or failure.',
    ]: d.bullet(x)
    d.h('1. Starting companies')
    d.p('Show this table and then give each fund the fuller one-paragraph profiles. Use code names throughout the game.')
    d.table(['Code name', 'Sector', 'What it does', 'Initial public signal'], [
        ['Project Signal', 'B2B SaaS / AI', 'Subscription software that helps companies search patents, science and competitors.', 'High-value enterprise problem; long sales cycles and product complexity.'],
        ['Project Motor', 'Mobility / Automotive', 'Online used-car marketplace with inspection, financing and after-sales services.', 'Large market and trust gap; inventory and working-capital risk.'],
        ['Project Loom', 'Commerce / Marketplace', 'Platform helping fashion merchants sell online with marketplace and logistics tools.', 'Regional ambition; low-margin operations and reporting complexity.'],
        ['Project Hive', 'Commerce / Marketplace', 'Online grocery and food delivery, with experiments in physical retail.', 'Convenient consumer product; delivery costs, fixed commitments and cash burn.'],
        ['Project Wallet', 'Fintech / Financial inclusion', 'Pay-as-you-go assets and digital financial services for underserved customers.', 'Strong repayment potential; credit, currency and funding-structure risk.'],
        ['Project MedAir', 'MedTech / Health logistics', 'Autonomous drone delivery of medical supplies and other urgent goods.', 'Important use case and regulatory moat; contract concentration and deployment cost.'],
        ['Project Social', 'Consumer social', 'Social platform designed around local-language communities.', 'Engagement opportunity; monetisation, retention, moderation and competition risk.'],
        ['Project Route', 'Mobility / Logistics', 'Rapid grocery delivery using local warehouses and delivery riders.', 'Fast growth opportunity; thin margins and high dependence on new capital.'],
    ], [1.05, 1.35, 2.55, 2.35], 7.6)
    d.h('2. Exact run of show: 2 hours')
    d.table(['Time', 'Stage', 'Facilitator action', 'Fund action'], [
        ['0:00–0:08', 'Welcome and fund setup', 'Assign teams, give 100 credits and role cards.', 'Choose fund name, roles and one-sentence thesis.'],
        ['0:08–0:18', 'VC knowledge quiz', 'Run 10 questions; record scores.', 'Answer together. Quiz score determines first company-choice order.'],
        ['0:18–0:30', 'Public profiles', 'Reveal all 8 anonymised profiles and answer rules questions only.', 'Build an initial portfolio thesis; no investment yet.'],
        ['0:30–0:38', 'Pre-Series A', 'Open the first ticket window; collect decisions.', 'Invest 0–20 credits per company. Record reason and risk.'],
        ['0:38–0:46', 'Marketplace 1', 'Allow short negotiation and syndication.', 'Trade information, use one special power and decide whether to reserve cash.'],
        ['0:46–0:54', 'Global event', 'Reveal the same funding-climate event to every fund.', 'Reassess runway, unit economics and follow-on appetite.'],
        ['0:54–1:04', 'Private diligence', 'Give each fund one Diligence Token and run 90-second private rooms.', 'Choose one company to investigate; share or conceal the fact.'],
        ['1:04–1:16', 'Series A', 'Reveal updated public metrics; collect decisions.', 'Invest, pass or follow on. State the milestone required for the next round.'],
        ['1:16–1:24', 'Marketplace 2', 'Allow follow-on negotiation and optional sales.', 'Hold, sell for 60% of the original ticket or negotiate a co-investment.'],
        ['1:24–1:34', 'Six sector events', 'Reveal one event per sector; read the two Mobility and two Commerce cards together.', 'Update the thesis. Every signal must be treated as uncertain.'],
        ['1:34–1:46', 'Series B', 'Collect final investment / hold / sell decisions.', 'Make the last ticket decision using the most information available.'],
        ['1:46–1:52', 'Final fund pitch', 'Give each fund 60 seconds.', 'Explain the portfolio, one miss and one decision you are proud of.'],
        ['1:52–2:00', 'Reveal and awards', 'Reveal real names, outcomes, private facts, score and awards.', 'Calculate returns and discuss what changed at each round.'],
    ], [0.82, 1.2, 2.85, 2.45], 7.3)
    d.page_break()
    d.h('3. “If we invest at this round, what do we do?”')
    d.table(['Round', 'Information available', 'Fund action', 'Maximum upside', 'Next step'], [
        ['Pre-Series A', 'Public profile + one initial thesis; private fact not yet accessed.', 'Invest 0–20 credits or pass. Write one risk and one milestone.', '4× if successful', 'Wait for global event and diligence.'],
        ['Series A', 'Global event + updated public signal + optional private diligence fact.', 'Invest, follow on, pass or hold. Write what evidence changed your view.', '3× if successful', 'Prepare for sector-specific events.'],
        ['Series B', 'Sector event + company-specific turning point + all public information so far.', 'Invest, hold, or sell. Lock the final ticket before the reveal.', '2× if successful', 'Give final pitch; then settle returns.'],
    ], [1.15, 2.1, 2.25, 1.0, 1.0], 7.2)
    d.h('4. Returns and winner')
    d.table(['Ticket made at', 'Successful company', 'Failed company', 'What this teaches'], [
        ['Pre-Series A', 'Ticket × 4', 'Ticket × 0', 'Highest risk and highest potential upside.'],
        ['Series A', 'Ticket × 3', 'Ticket × 0', 'More evidence; less upside.'],
        ['Series B', 'Ticket × 2', 'Ticket × 0', 'Most evidence; lowest upside.'],
        ['Uninvested credits', 'Remain at × 1', 'Remain at × 1', 'Cash is a valid portfolio decision.'],
        ['Sell after an event', 'Receive 60% of original ticket', 'Receive 60% of original ticket', 'Exit protects some capital but gives up future upside.'],
    ], [1.35, 1.5, 1.5, 2.95], 8.0)
    d.p('Final fund value = remaining cash + realised sale proceeds + settled tickets. The winning fund is the highest-value fund. In a tie, use the stronger reasoning score, then the higher diversification score.')
    d.p('Team awards: Best Analyst, Best Skeptic, Best Negotiator, Best Storyteller and Best Team Spirit. These are fun individual recognitions; they do not replace the fund-level winner.')
    d.h('5. Fund roles and decision discipline')
    d.table(['Role', 'Job during each round'], [
        ['General Partner', 'Calls the investment committee decision and keeps the fund on thesis.'],
        ['Market Analyst', 'Tests customers, competitors, market size and sector signals.'],
        ['Finance Partner', 'Tracks credits, burn, runway, unit economics and valuation logic.'],
        ['Product / Impact Partner', 'Tests product usefulness, adoption, regulation and execution.'],
        ['Skeptic', 'Must state the best reason not to invest before any ticket is submitted.'],
    ], [1.75, 5.55], 8.5)
    d.page_break()
    d.h('6. Company profiles for participants')
    participant_profiles = [
        ['Project Signal', 'B2B SaaS / AI', 'A Singapore-founded software company helps research and innovation teams search patents, scientific information and competitors. It sells to organisations rather than individual consumers. The market is valuable, but enterprise sales are complex and slow.'],
        ['Project Motor', 'Mobility / Automotive', 'A Southeast Asian online marketplace makes used-car transactions easier through listings, inspections, financing and after-sales services. Trust is a real customer pain point, but inventory and working capital matter.'],
        ['Project Loom', 'Commerce / Marketplace', 'A regional technology platform helps fashion merchants sell online and provides marketplace, logistics and business tools. It is chasing a fragmented market across several countries.'],
        ['Project Hive', 'Commerce / Marketplace', 'An online grocery and food-delivery business promises convenience and has experimented with physical retail. Customers like the service, but delivery economics and fixed costs are difficult.'],
        ['Project Wallet', 'Fintech / Financial inclusion', 'A financial-inclusion company lets customers access productive assets through pay-as-you-go financing and adds digital financial services. Repayment behaviour and funding structure are central to the thesis.'],
        ['Project MedAir', 'MedTech / Health logistics', 'A drone-delivery company moves medical supplies and other urgent goods autonomously. Contracts and regulation can create a moat, but deployment requires capital and operational execution.'],
        ['Project Social', 'Consumer social', 'A social platform is built around local-language communities and aims to create a more relevant alternative to global platforms. Engagement can be strong while monetisation remains uncertain.'],
        ['Project Route', 'Mobility / Logistics', 'A rapid-grocery company uses local warehouses and riders to promise very fast delivery. Growth can be impressive, but each order must eventually make economic sense.'],
    ]
    d.table(['Code name', 'Sector', 'Participant profile'], participant_profiles, [1.1, 1.45, 4.75], 7.75)
    d.h('7. Quiz: use before any company decision')
    d.table(['Question', 'Correct answer'], [
        ['What is Seed funding?', 'Early capital used to test the idea and find initial customers.'],
        ['What does Series A usually signal?', 'The company has some product-market evidence and is building a repeatable growth engine.'],
        ['What does Series B usually fund?', 'Scaling a business with stronger traction and a clearer expansion plan.'],
        ['What is runway?', 'The time before the company runs out of cash at its current burn rate.'],
        ['What is dilution?', 'A smaller ownership percentage after new shares are issued.'],
        ['What is a lead investor?', 'The investor that leads the round and negotiates key terms.'],
        ['Why do funds diversify?', 'To reduce dependence on any one company succeeding.'],
        ['What is a follow-on investment?', 'Capital invested in a later round of the same company.'],
    ], [3.1, 4.2], 8.1)
    d.h('8. Event cards: reveal at the marked moments')
    d.h('8.1 Global event — reveal immediately before private diligence')
    d.table(['Card', 'Read aloud'], [['The funding climate turns cold', 'Interest rates rise, investors become more selective, and new rounds take longer to close. Stronger runway, retention and unit economics now matter more than an impressive growth story alone.']], [1.65, 5.65], 8.4, header_fill=TEAL)
    d.h('8.2 Six sector-wide events — reveal immediately before Series B')
    d.table(['Sector', 'Companies affected', 'Read aloud', 'Question to discuss'], [
        ['B2B SaaS / AI', 'Project Signal', 'Enterprise procurement cycles lengthen. Customers still need the product, but approvals and budgets move more slowly.', 'Does recurring demand outweigh a slower sales cycle?'],
        ['Mobility / Automotive', 'Project Motor + Project Route', 'Financing rates and inventory costs rise while customers become more price-sensitive.', 'Which model can survive without constantly buying growth?'],
        ['Commerce / Marketplace', 'Project Loom + Project Hive', 'Shipping disruption, platform competition and fulfilment costs make growth more expensive.', 'Is scale creating a moat or just more operational complexity?'],
        ['Fintech / Financial inclusion', 'Project Wallet', 'New consumer-lending and compliance requirements demand more capital and stronger risk controls.', 'Can responsible growth be financed?'],
        ['MedTech / Health logistics', 'Project MedAir', 'Regulatory approvals and public procurement timelines slow down new deployments.', 'Can the company fund the wait for durable contracts?'],
        ['Consumer social', 'Project Social', 'Users and advertisers shift between platforms while moderation and trust costs increase.', 'Is engagement enough without a repeatable business model?'],
    ], [1.35, 1.25, 3.0, 1.7], 7.15)
    d.page_break()
    d.h('8.3 Company-specific turning points — reveal immediately before the final decision')
    d.table(['Code name', 'Read aloud', 'Decision tension'], [
        ['Project Signal', 'A strategic investor is considering a large round, but wants aggressive global expansion and high growth targets.', 'Focus the product or pursue a bigger but more demanding market?'],
        ['Project Motor', 'A major growth round is available, but its terms assume fast regional expansion and a heavier financing programme.', 'Scale now or protect the path to profitability?'],
        ['Project Loom', 'The board wants stronger financial controls and clearer reporting before approving more capital. Management argues that slowing down will lose the market window.', 'Control and transparency or speed?'],
        ['Project Hive', 'Suppliers and creditors are more cautious. Management proposes restructuring and asks for bridge funding to preserve the core business.', 'Rescue the core or protect capital?'],
        ['Project Wallet', 'New financing and customer growth create a route to scale, but the debt/equity mix and credit losses must be actively managed.', 'Can growth stay responsible as the book gets larger?'],
        ['Project MedAir', 'New government and commercial contracts are available, but regulatory execution and deployment require significant capital.', 'Fund the infrastructure before the contracts fully mature?'],
        ['Project Social', 'Acquisition and partnership discussions create a possible rescue, but monetisation and retention are still unresolved.', 'Is strategic value enough to justify more capital?'],
        ['Project Route', 'A few cities are approaching better margins, but the company needs another round before runway expires.', 'Bet on operational improvement or stop funding the experiment?'],
    ], [1.15, 4.25, 1.9], 7.25)
    d.h('9. Final scoring sheet')
    d.table(['Category', 'Points', 'How to score'], [
        ['Final portfolio value', '45', 'Normalise the highest fund value to 45; scale the other funds proportionally.'],
        ['Investment reasoning', '25', 'Risk, evidence, milestone and explanation across the three rounds.'],
        ['VC knowledge quiz', '10', 'Raw quiz score.'],
        ['Diversification', '10', 'Spread across sectors and avoid concentrating every ticket in one thesis.'],
        ['Negotiation and teamwork', '5', 'Constructive information sharing, role use and time discipline.'],
        ['Final pitch', '5', 'Clear 60-second portfolio story with one honest miss.'],
    ], [1.8, .65, 4.85], 8.2)
    d.page_break()
    d.h('Facilitator-only appendix — do not share before final reveal')
    d.p('The purpose of this appendix is to protect the suspense. Open it only after all final decisions and pitches are locked.')
    d.h('10. Private Company Confidential cards')
    d.table(['Code name', 'Company-only fact', 'How to deliver it'], [
        ['Project Signal', 'Approximately 70% of revenue is recurring, but the three largest customers represent a meaningful concentration risk.', 'Read exactly as written to a fund that uses its Diligence Token. Do not add a positive or negative tone.'],
        ['Project Motor', 'Some cities have attractive unit economics, but the model is working-capital heavy because inventory and financing must be managed.', 'If asked whether the whole business is profitable, say: “The card does not answer that.”'],
        ['Project Loom', 'Reported marketplace activity is growing, but management and investors are using different definitions of revenue and gross merchandise value.', 'Do not translate the fact into “fraud” or “failure”; it is an information-quality risk.'],
        ['Project Hive', 'Delivery economics are positive in dense neighbourhoods, but the physical concept has long-term fixed commitments.', 'The fund must decide whether the good local economics can carry the wider cost base.'],
        ['Project Wallet', 'Repayment data is stronger than public metrics suggest, but currency volatility and credit-loss risk remain material.', 'Do not reveal whether the risk is already hurting the company.'],
        ['Project MedAir', 'Health contracts improve outcomes for customers, but government payment cycles and contract concentration can slow cash collection.', 'If asked about demand, share the card only; do not confirm a funding date.'],
        ['Project Social', 'Engagement is strong in one language cohort, but monetisation and retention are weaker in other cohorts.', 'The fund should ask whether the strong cohort can expand.'],
        ['Project Route', 'A few cities are close to contribution-margin positive, but company-wide runway is shorter than management would like.', 'This is a runway-versus-unit-economics trade-off, not a prediction.'],
    ], [1.15, 4.4, 1.75], 7.25)
    d.h('11. Real-company reveal and outcome key')
    d.p('Reveal the real name only after all funds submit the final decision sheet. Read the timeline, then reveal the outcome. Keep the four success / four failure balance visible only to the facilitator until this point.')
    d.table(['Code name', 'Real company', 'Six-sector label', 'Outcome for scoring', 'Reveal summary'], [
        ['Project Signal', 'PatSnap', 'B2B SaaS / AI', 'SUCCESS', 'Singapore-founded innovation-intelligence software company; raised a large late-stage round and continued operating as a global company.'],
        ['Project Motor', 'Carro', 'Mobility / Automotive', 'SUCCESS', 'Southeast Asian used-car marketplace; reached operational profitability and continued expanding its platform.'],
        ['Project Loom', 'Zilingo', 'Commerce / Marketplace', 'FAILED', 'Fashion-commerce startup; after governance and reporting turmoil, it entered liquidation / winding-up. Use neutral wording and cite public reporting.'],
        ['Project Hive', 'honestbee', 'Commerce / Marketplace', 'FAILED', 'Grocery and food-delivery startup; the Singapore High Court record shows it was wound up in 2020.'],
        ['Project Wallet', 'M-KOPA', 'Fintech / Financial inclusion', 'SUCCESS', 'Asset-financing and financial-services company; announced more than US$250m in new financing and later reported 3m active customers.'],
        ['Project MedAir', 'Zipline', 'MedTech / Health logistics', 'SUCCESS', 'Autonomous drone-delivery company; reported more than 2m deliveries and more than US$600m raised for its next growth phase.'],
        ['Project Social', 'Koo', 'Consumer social', 'FAILED', 'Indian social platform; shut down in 2024 after acquisition discussions fell through and funding / monetisation challenges persisted.'],
        ['Project Route', 'Airlift Technologies', 'Mobility / Logistics', 'FAILED', 'Pakistani rapid-delivery company; raised a major Series B, then shut down in 2022 amid a difficult funding environment.'],
    ], [1.05, 1.25, 1.45, .8, 2.75], 6.8)
    add_source_table(d)
    path = ROOT / 'VC_Time_Machine_Event_Flow_Updated.docx'
    d.save(path)
    return path


def build_minutes():
    d = VCDoc('VC Time Machine Planning Meeting Minutes', 'Draft record of decisions, open questions and owners', 'VC Time Machine  |  Start It NUS Club  |  Draft Minutes')
    d.title_page()
    d.h('Recording note')
    d.p('Draft status: the supplied M4A could not be transcribed in this workspace because macOS speech-recognition access was denied. These minutes are based on the written instructions in this thread and the previous event pack, and should be checked against the recording before circulation.')
    d.h('Meeting details')
    d.table(['Item', 'Record'], [
        ['Meeting', 'VC Time Machine planning meeting'],
        ['Club', 'Start It NUS Club'],
        ['Status', 'Draft — verify against recording'],
        ['Final draft outline due', '21 September'],
        ['Next coordination', 'One final meeting at most; use async comments if a meeting is unnecessary'],
    ], [1.8, 5.5], 9)
    d.h('Decisions captured from the written discussion')
    decisions = [
        'Replace ShopBack with a less obvious company set and retain the “real company, anonymous code name” reveal format.',
        'Expand the game from 6 to 8 companies across 6 technology sectors.',
        'Use a balanced outcome set: 4 companies that ultimately succeed and 4 that ultimately fail.',
        'Make the team-facing document flow-only: starting companies, sector, what each company does, funding rounds, information releases, decisions, reveal and scoring.',
        'Participants compete as VC funds. Individual roles are used inside each fund, with separate individual awards for fun and recognition.',
        'Give all investors public information before each round, while some material but ambiguous facts remain company-only and can be accessed through limited diligence tokens.',
        'Use three information layers: a global event affecting everyone, sector-wide events affecting related companies, and company-specific turning points before the final decision.',
        'Make the information-to-upside trade-off explicit: Pre-Series A has the highest potential return, Series A has more evidence and lower upside, and Series B has the most information and the lowest upside.',
        'Lock all final decisions before revealing real names, private facts and outcomes so participants cannot predict the answer too early.',
        'Prepare three documents for the team: updated event flow, meeting minutes and a clear To Do list.',
    ]
    for x in decisions: d.bullet(x)
    d.h('Proposed format decisions to confirm')
    d.table(['Decision', 'Working recommendation', 'Confirm by'], [
        ['Teams', '4–5 people per fund; fund-level winner.', 'Final meeting / async'],
        ['Participants', 'Target 4–8 funds; set the final number once registrations are known.', 'Before materials'],
        ['Company representatives', 'Use volunteer “company CEOs” if available; otherwise facilitator holds all private cards.', 'Before dry run'],
        ['Meeting cadence', 'One 60–75 minute finalisation meeting, unless async comments close every open item.', '17 September'],
        ['Submission format', 'Google Docs-ready Word files plus final slides / handouts.', 'Before 21 September'],
    ], [1.55, 4.4, 1.35], 8.1)
    d.h('Action items')
    d.table(['Workstream', 'Action', 'Owner', 'Due', 'Status'], [
        ['Company research', 'Verify the eight real-company timelines and reveal wording using primary or reputable sources.', 'To assign', '17 Sep', 'Open'],
        ['Company profiles', 'Edit each anonymised profile so it is interesting but does not reveal the outcome.', 'To assign', '17 Sep', 'Open'],
        ['Private information', 'Prepare and test one Company Confidential card per company.', 'To assign', '18 Sep', 'Open'],
        ['Event design', 'Write and balance the global, six sector and eight company-specific event cards.', 'To assign', '18 Sep', 'Open'],
        ['Game mechanics', 'Confirm ticket cap, return multipliers, sell rule, special powers and tie-breakers.', 'To assign', '17 Sep', 'Open'],
        ['Quiz', 'Create the 10-question VC basics quiz and answer key.', 'To assign', '18 Sep', 'Open'],
        ['Materials', 'Create slides, decision sheets, private cards, fund ledgers and final reveal deck.', 'To assign', '19 Sep', 'Open'],
        ['Logistics', 'Confirm room, timing, team count, printing, prizes and facilitator roles.', 'To assign', '19 Sep', 'Open'],
        ['Dry run', 'Run the full game with at least one test fund and check that failure / success is not obvious.', 'To assign', '20 Sep', 'Open'],
        ['Submission', 'Proofread and submit the final draft outline.', 'To assign', '21 Sep', 'Open'],
    ], [1.1, 3.55, 1.0, .8, .8], 7.55)
    d.h('Open questions')
    for x in [
        'What is the exact event date, venue and expected participant count?',
        'How many VC funds should be formed, and should every fund have the same number of members?',
        'Will there be people available to play the company representatives, or should the host manage all confidential cards?',
        'Should the final handout be printed, digital, or both?',
        'Do the organisers want the five individual awards listed above, or a different award set?',
        'Is the 21 September submission an internal outline or the final event pack including slides and handouts?',
    ]: d.bullet(x)
    d.h('Finalisation meeting agenda — 60 to 75 minutes')
    d.table(['Time', 'Item', 'Output'], [
        ['0–5 min', 'Confirm audience, tone and 21 Sep submission requirement.', 'Shared definition of done.'],
        ['5–15 min', 'Each person shares one idea or concern.', 'Shortlist of useful changes.'],
        ['15–25 min', 'Confirm 8 companies and 6-sector balance.', 'Final company list and sector labels.'],
        ['25–35 min', 'Lock rounds, tickets, returns, sales and scoring.', 'One-page rules sheet.'],
        ['35–45 min', 'Review public, confidential, global, sector and company-specific information.', 'No-spoiler information map.'],
        ['45–55 min', 'Confirm run time, roles, room setup and materials.', 'Logistics checklist.'],
        ['55–65 min', 'Assign every open task and owner.', 'Named owner and deadline for each task.'],
        ['65–75 min', 'Read back decisions and sign off the outline.', 'Submission-ready outline or final async edits.'],
    ], [1.0, 3.65, 2.65], 8.3)
    d.h('Async fallback if no meeting is needed')
    for x in ['Share this minutes document and the updated flow document for comments by 15 September.', 'Ask each member to comment only on decisions that change the event, not wording preferences.', 'Resolve comments in one 30-minute call or in a single written decision post by 17 September.', 'Move directly to dry run and final proofread once all owners and deadlines are confirmed.']: d.bullet(x)
    d.h('Source note')
    d.p('The previous event pack and the written planning discussion were used as background. The supplied audio file remains unverified because speech-recognition access was denied in the working environment.')
    path = ROOT / 'VC_Time_Machine_Meeting_Minutes_Draft.docx'
    d.save(path)
    return path


def build_todo():
    d = VCDoc('VC Time Machine: To Do', 'A single action list for finalising and submitting the event outline by 21 September', 'VC Time Machine  |  Start It NUS Club  |  To Do')
    d.title_page()
    d.h('Definition of done')
    d.p('By 21 September, the team has a coherent, spoiler-safe 2-hour event outline, confirmed company and event cards, ready-to-use decision sheets, a tested scoring system, named owners for event-day roles and a final submission copy.')
    d.h('Critical path')
    d.table(['Date', 'Must be complete', 'Owner'], [
        ['13–14 Sep', 'Everyone sends final ideas, concerns and any company / sector suggestions.', 'All team members'],
        ['15–17 Sep', 'Hold the one finalisation meeting, or close all decisions asynchronously.', 'Meeting lead'],
        ['17–18 Sep', 'Verify the eight timelines; lock profiles, sectors, public signals, private facts and event cards.', 'Research + game leads'],
        ['18–19 Sep', 'Create the flow slides, handouts, quiz, fund ledger, decision sheets and scoring sheet.', 'Materials lead'],
        ['20 Sep', 'Run a dry test, remove spoiler clues, proofread and check timing.', 'All team members'],
        ['21 Sep', 'Submit final draft outline.', 'Submission owner'],
    ], [1.0, 5.25, 1.05], 8.3)
    d.h('Master checklist')
    d.table(['Priority', 'Workstream', 'Task', 'Owner', 'Due', 'Status'], [
        ['P0', 'Scope', 'Confirm event date, venue, participants and submission format.', 'To assign', '15 Sep', '☐'],
        ['P0', 'Companies', 'Lock 8 code names across 6 sectors: 4 success / 4 failure.', 'To assign', '17 Sep', '☐'],
        ['P0', 'Research', 'Verify factual reveal timelines and save source links.', 'To assign', '17 Sep', '☐'],
        ['P0', 'Information design', 'Prepare public profile for each company without outcome giveaways.', 'To assign', '18 Sep', '☐'],
        ['P0', 'Information design', 'Prepare 8 Company Confidential cards and a diligence-token rule.', 'To assign', '18 Sep', '☐'],
        ['P0', 'Events', 'Prepare 1 global event, 6 sector events and 8 company-specific turning points.', 'To assign', '18 Sep', '☐'],
        ['P0', 'Mechanics', 'Confirm Pre-Series A / A / B returns, ticket limits and 60% sell rule.', 'To assign', '17 Sep', '☐'],
        ['P0', 'Scoring', 'Confirm fund-level scoring and individual awards.', 'To assign', '17 Sep', '☐'],
        ['P1', 'Quiz', 'Write 10 basic VC terminology questions and answer key.', 'To assign', '18 Sep', '☐'],
        ['P1', 'Materials', 'Build slides with one reveal stage per section.', 'To assign', '19 Sep', '☐'],
        ['P1', 'Materials', 'Print / export company profiles, decision sheets, cards and ledgers.', 'To assign', '19 Sep', '☐'],
        ['P1', 'Facilitation', 'Assign MC, timekeeper, banker, diligence host and reveal lead.', 'To assign', '19 Sep', '☐'],
        ['P1', 'Dry run', 'Test whether the winning companies are genuinely hard to predict.', 'To assign', '20 Sep', '☐'],
        ['P1', 'Dry run', 'Test calculation examples: early winner, late winner, failure, sale and tie-break.', 'To assign', '20 Sep', '☐'],
        ['P0', 'Submission', 'Proofread and send final draft outline by 21 September.', 'To assign', '21 Sep', '☐'],
    ], [.45, 1.05, 3.45, 1.0, .7, .55], 7.25)
    d.h('Decision log to complete')
    d.table(['Decision', 'Final answer', 'Owner / date'], [
        ['Event date and room', '', ''],
        ['Expected participants / number of funds', '', ''],
        ['Company representatives available?', '', ''],
        ['Printed, digital or both?', '', ''],
        ['Special powers included?', '', ''],
        ['Final prizes / awards', '', ''],
        ['Submission recipient and format', '', ''],
    ], [2.45, 3.55, 1.2], 8.2)
    d.h('Meeting agenda if the team holds one more meeting')
    d.table(['Time', 'Agenda item', 'Decision required'], [
        ['0–5 min', 'Confirm definition of done and deadline.', 'What must be finished by 21 Sep?'],
        ['5–15 min', 'Share final ideas and concerns.', 'Which changes materially improve the event?'],
        ['15–25 min', 'Confirm companies and sector balance.', 'Are the 8 companies understandable and non-obvious?'],
        ['25–35 min', 'Lock game mechanics.', 'Are returns, tickets, sells and scoring final?'],
        ['35–45 min', 'Review information releases.', 'Is the public / private / global / sector / company sequence fair?'],
        ['45–55 min', 'Review event-day logistics.', 'Who runs each part, and what must be printed?'],
        ['55–65 min', 'Assign owners and dates.', 'Does every task have one accountable person?'],
        ['65–75 min', 'Read back decisions and sign off.', 'Can the draft go to dry run?'],
    ], [1.0, 3.1, 3.1], 8.1)
    d.h('Suggested owner map')
    d.table(['Role', 'Owns'], [
        ['Meeting lead', 'Agenda, decisions, unresolved questions and 21 Sep submission.'],
        ['Research lead', 'Company timelines, sources and facilitator answer key.'],
        ['Game lead', 'Rounds, tickets, returns, sale rule, scoring and decision sheets.'],
        ['Content lead', 'Anonymised profiles, quiz, public signals and event wording.'],
        ['Materials lead', 'Slides, handouts, confidential cards, ledgers and print / export.'],
        ['Event-day lead', 'MC, timekeeping, rooms, teams, reveal and awards.'],
    ], [1.55, 5.75], 8.5)
    d.h('Last check before submission')
    for x in [
        'A participant can understand what to do at every stage without seeing the facilitator appendix.',
        'Every round gives more information and lower maximum upside than the previous round.',
        'Company-only information is clearly labelled and is never shown to all investors automatically.',
        'The global event affects all companies; the sector cards affect the correct companies; the final cards are company-specific.',
        'No code name, event card or public profile makes the final outcome obvious before the reveal.',
        'All eight reveal sources are saved and the neutral wording has been checked.',
        'The dry run fits the promised time and the final value calculation is easy to audit.',
    ]: d.bullet(x)
    path = ROOT / 'VC_Time_Machine_To_Do.docx'
    d.save(path)
    return path


if __name__ == '__main__':
    for p in [build_flow(), build_minutes(), build_todo()]:
        print(p)
