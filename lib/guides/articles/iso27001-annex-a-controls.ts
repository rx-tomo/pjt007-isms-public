import type { GuideArticle, GuideBlock, GuideLocale } from '../types';
import type { AnnexATheme } from '../data/annex-a-controls';
import { ANNEX_A_CONTROLS } from '../data/annex-a-controls';

/** テーマ別の管理策表を生成する。新設管理策には印を付ける。 */
function controlTable(
  theme: AnnexATheme,
  locale: GuideLocale,
  headers: [string, string, string],
  newMark: string,
): GuideBlock {
  const rows = ANNEX_A_CONTROLS.filter((control) => control.theme === theme).map((control) => [
    control.id,
    control[locale],
    control.isNew ? newMark : '',
  ]);
  return { type: 'table', headers, rows };
}

const JA_HEADERS: [string, string, string] = ['番号', '管理策', '2022新設'];
const EN_HEADERS: [string, string, string] = ['No.', 'Control', 'New in 2022'];
const ZH_HEADERS: [string, string, string] = ['编号', '控制措施', '2022新增'];

const JA_MARK = '★新設';
const EN_MARK = '★ New';
const ZH_MARK = '★新增';

export const iso27001AnnexAControls: GuideArticle = {
  slug: 'iso27001-annex-a-controls',
  publishedAt: '2026-09-11',
  updatedAt: '2026-09-11',
  related: ['isms-risk-assessment', 'isms-required-documents', 'iso27001-certification-process'],
  content: {
    ja: {
      title: 'ISO27001:2022 附属書A 管理策一覧｜4テーマ93項目と2013年版からの変更点',
      metaTitle: 'ISO27001附属書A管理策一覧｜93項目と変更点',
      description:
        'ISO/IEC 27001:2022 附属書Aの93管理策を、組織的37・人的8・物理的14・技術的34の4テーマ別に一覧化。2013年版114管理策からの統合と新設11管理策、適用宣言書での使い方まで整理します。',
      lead:
        'ISO/IEC 27001:2022の附属書Aには、4つのテーマに分かれた93の管理策が並んでいます。組織的37、人的8、物理的14、技術的34で、このうち11は2022年版で新しく加わったものです。ここで誤解されやすいのが附属書Aの役割です。附属書Aは好きなものを選ぶメニューではなく、リスク対応で必要と決めた管理策を出したあとに、見落としがないかを照合するための参照リストとして使います。箇条6.1.3 c)が求めているのはその比較であり、順序を逆にすると「表を埋めるための対策」になりがちです。本記事では93管理策を4テーマ別の表で一覧化し、2013年版からの変更点、適用宣言書での扱い方までを整理します。',
      blocks: [
        {
          type: 'h2',
          id: 'what-is-annex-a',
          text: '附属書Aとは何か（ISO27001とISO27002の関係）',
        },
        {
          type: 'p',
          text: '附属書AはISO/IEC 27001:2022の一部で、情報セキュリティ管理策の参照リストです。**規範的**な位置づけであり、ここに並ぶ管理策を「知らなかった」で済ませないための照合対象になります。一方で、各管理策をどう実装するかの手引きは別の規格ISO/IEC 27002:2022が担当します。27002は**手引き**であり、審査基準そのものではありません。',
        },
        {
          type: 'p',
          text: 'この2つの役割の違いは、作業の順番にそのまま影響します。まずリスクアセスメントとリスク対応で、自組織に必要な管理策を決めます（[ISMSのリスクアセスメント](/guide/isms-risk-assessment)で手順を扱っています）。次に、決めた管理策の一覧を附属書Aと突き合わせ、見落としている領域がないかを確認します。ここで初めて27002を開き、実装の考え方や具体例を参照する、という流れです。',
        },
        {
          type: 'callout',
          title: '附属書Aは「選ぶ」ものではなく「照合する」もの',
          text: '93項目を上から順に読んで自社に当てはめていく進め方は、一見効率的に見えて、リスクとの対応関係を後付けで作ることになります。結果として、リスクが説明できない対策と、対策が紐づかないリスクが同時に残ります。必要な管理策を先に決め、附属書Aは抜け漏れの検証に使ってください。',
        },
        {
          type: 'h2',
          id: 'changes-from-2013',
          text: '2013年版からの変更点（114→93、14分野→4テーマ）',
        },
        {
          type: 'p',
          text: '2013年版の附属書Aは14分野114管理策という構成でした。2022年版では4テーマ93管理策になっています。数が減ったのは要求が緩くなったからではなく、内容の重複していた管理策が統合されたためです。分類の粒度が粗くなったぶん、1つの管理策がカバーする範囲は広がっています。',
        },
        {
          type: 'table',
          headers: ['観点', '2013年版', '2022年版'],
          rows: [
            ['管理策の数', '114', '93'],
            ['分類', '14分野（A.5〜A.18）', '4テーマ（5〜8）'],
            ['テーマ内訳', 'アクセス制御・暗号など分野別', '組織的37／人的8／物理的14／技術的34'],
            ['新設', '—', '11管理策'],
            ['属性', 'なし', '5種類の属性が付与'],
          ],
        },
        {
          type: 'p',
          text: '新設された11管理策は、クラウド利用、テレワーク、ログ監視、開発現場の実務といった、この10年で当たり前になった働き方と技術に対応するものです。具体的には5.7 脅威インテリジェンス、5.23 クラウドサービスの利用における情報セキュリティ、5.30 事業継続のためのICTの備え、7.4 物理的セキュリティの監視、8.9 構成管理、8.10 情報の削除、8.11 データマスキング、8.12 データ漏えい防止、8.16 監視活動、8.23 ウェブフィルタリング、8.28 セキュリティに配慮したコーディングの11項目です。SaaSを開発・利用するIT企業にとっては、いずれも既に何らかの形で運用している領域が多いはずで、ゼロから作るというより、既存の運用を管理策として言語化する作業になります。',
        },
        {
          type: 'p',
          text: 'もう1つの変更が**属性**です。2022年版では各管理策に5種類の属性が付与されました。管理策タイプ（予防／検知／是正）、情報セキュリティ特性（機密性／完全性／可用性）、サイバーセキュリティ概念（識別／防御／検知／対応／復旧）、運用能力（ガバナンス、資産管理など）、セキュリティドメイン（ガバナンスとエコシステム、保護、防御、レジリエンス）の5つです。これは管理策を別の切り口で並べ替えて分析するための仕組みで、属性による分類そのものが要求事項になっているわけではありません。',
        },
        {
          type: 'h2',
          id: 'organizational-controls',
          text: '組織的管理策（5.1〜5.37）の一覧',
        },
        {
          type: 'p',
          text: '37項目と最も数が多く、方針・体制・供給者管理・インシデント対応・法令順守までを含みます。2013年版で分野をまたいでいた管理策が、ここに集約されている点が特徴です。文書として整備する対象が多いテーマでもあり、必要な文書の全体像は[ISMSで必要な文書一覧](/guide/isms-required-documents)にまとめています。',
        },
        controlTable('organizational', 'ja', JA_HEADERS, JA_MARK),
        {
          type: 'h2',
          id: 'people-controls',
          text: '人的管理策（6.1〜6.8）の一覧',
        },
        {
          type: 'p',
          text: '採用から退職までの人に関わる管理策です。8項目と少ないものの、就業規則・雇用契約・入退社手続きといった既存の人事プロセスと重なるため、情報システム部門だけでは完結しません。リモートワークが独立した管理策になっている点は、2013年版との実務上の差が出やすいところです。',
        },
        controlTable('people', 'ja', JA_HEADERS, JA_MARK),
        {
          type: 'h2',
          id: 'physical-controls',
          text: '物理的管理策（7.1〜7.14）の一覧',
        },
        {
          type: 'p',
          text: '入退管理、装置、記憶媒体、廃棄までを扱います。自社サーバールームを持たずクラウドのみで運用する企業でも、オフィスの入退室、社用PCの持ち出し、返却と廃棄は対象に残ります。適用範囲の切り方によって関係する項目が変わるテーマです。',
        },
        controlTable('physical', 'ja', JA_HEADERS, JA_MARK),
        {
          type: 'h2',
          id: 'technological-controls',
          text: '技術的管理策（8.1〜8.34）の一覧',
        },
        {
          type: 'p',
          text: '34項目とテーマ別では2番目に多く、新設11のうち7項目がここに含まれます。アクセス制御、暗号、ログ、ネットワーク、開発ライフサイクルが対象で、IT企業では既存の開発・運用ルールと重複する部分が大きくなります。',
        },
        controlTable('technological', 'ja', JA_HEADERS, JA_MARK),
        {
          type: 'h2',
          id: 'soa-usage',
          text: '適用宣言書（SoA）での使い方',
        },
        {
          type: 'p',
          text: '附属書Aの93管理策が最終的に集約されるのが、箇条6.1.3 d)が求める適用宣言書（SoA）です。SoAは93行の表として作られることが多く、各行に次の情報を持たせます。',
        },
        {
          type: 'ol',
          items: [
            '管理策番号と名称（附属書Aの93項目すべてを行として持つ）',
            '適用するかどうかの区分',
            '適用する理由（どのリスク対応から導かれたか、または法令・契約・自社方針のどれによるか）',
            '除外する場合の理由（自組織の活動に該当しない、という説明が成り立つか）',
            '実施状況と、実施を裏づける文書・記録の参照先',
          ],
        },
        {
          type: 'p',
          text: 'ここで審査時に確認されやすいのが、**リスク対応計画とSoAの行き来ができるか**です。リスク対応で選んだ管理策がSoAで適用になっていない、逆にSoAで適用としたのに対応する文書も記録も見当たらない、といった不整合は目につきやすい部分です。除外の理由も「該当なし」の一言では説明が弱く、なぜ該当しないのかを自社の活動に即して書く必要があります。',
        },
        {
          type: 'p',
          text: 'なお、除外できるかどうかはリスクアセスメントの結果次第です。たとえば自社で開発を行っていない企業が開発関連の管理策を除外することはあり得ますが、外部委託で開発している場合は8.30 外部委託による開発が関係してきます。「使っていないから除外」ではなく「自社の業務に登場しないから除外」という筋で考えてください。',
        },
        {
          type: 'h2',
          id: 'priority-for-smb',
          text: '中小IT企業が優先しやすい管理策の例',
        },
        {
          type: 'p',
          text: '優先順位は本来リスクアセスメントの結果で決まるもので、一律の正解はありません。そのうえで一般論として、100名規模までのIT企業では次の領域が着手の起点になりやすい傾向があります。自社の既存運用がそのまま管理策の実施状況になるため、新規に作る負担が比較的小さい領域でもあります。',
        },
        {
          type: 'ul',
          items: [
            '5.15／5.18／8.2 アクセス権と特権の管理 — SaaSアカウントの棚卸しが起点になり、入退社手続きとも連動する',
            '5.9／5.10 情報資産の目録と利用の許容範囲 — 何を守るかが決まらないと他の管理策の根拠が書けない',
            '5.23 クラウドサービスの利用における情報セキュリティ — 利用中のSaaSの選定・契約・退出の考え方を明文化する',
            '8.8 技術的脆弱性の管理 — 依存ライブラリとOSの更新について、検知から適用までの流れを決める',
            '8.15／8.16 ログ取得と監視活動 — 取得済みのログについて、誰がいつ見るかを決めるところから始める',
            '6.3 情報セキュリティの意識向上，教育及び訓練 — 年1回の実施記録が残せる形にする',
            '5.24〜5.27 インシデント管理 — 軽微な事象を含めて報告が上がる導線を作る',
          ],
        },
        {
          type: 'p',
          text: '逆に、初期の負荷が大きくなりやすいのは、新設の8.11 データマスキングや8.12 データ漏えい防止のように、ツール導入を伴う可能性がある管理策です。これらは扱う情報の性質によって必要性が大きく変わるため、リスクアセスメントの結果を踏まえて判断してください。認証取得までの全体の進め方は[ISO27001認証取得の進め方](/guide/iso27001-certification-process)で扱っています。',
        },
        {
          type: 'h2',
          id: 'managing-with-tools',
          text: '93管理策をツールで管理するという選択',
        },
        {
          type: 'p',
          text: '93管理策の一覧そのものは、スプレッドシートでも十分に作れます。負荷が増えるのは、リスク、管理策、SoA、文書、記録の4つ以上を相互に紐づけて維持する部分です。リスクを1件更新したときに、どのSoAの行とどの文書に影響するかを目視で追う運用は、管理策の数が93あると現実的に破綻しやすくなります。',
        },
        {
          type: 'p',
          text: '紐づけをツール側に持たせると、更新の波及が自動的に追跡され、適用・除外の理由が空欄のまま残っている行も検知しやすくなります。自社が93管理策のどこまで説明できる状態かを先に確かめたい場合は、[ISMS現在地セルフチェック](/research)から始めるとよいでしょう。',
        },
      ],
      faq: [
        {
          question: '93管理策は全部実施しなければいけませんか。',
          answer:
            'すべてを実施する必要はありません。実施の要否はリスクアセスメントとリスク対応の結果で決まり、自組織に該当しない管理策は適用宣言書で除外できます。ただし除外には理由の記載が必要で、93項目すべてについて検討した事実が残っている必要があります。検討しなかった項目があるという状態が問題になります。',
        },
        {
          question: '2013年版と2022年版の対応表はありますか。',
          answer:
            'ISO/IEC 27002:2022には、新旧の管理策番号の対応関係を示す付属の表が含まれています。1対1で対応するものばかりではなく、複数の旧管理策が1つに統合されたもの、逆に1つが複数にまたがるものがあります。旧版で構築済みの組織は、この対応関係をたどって既存の文書がどの新番号に該当するかを整理すると移行作業が進めやすくなります。',
        },
        {
          question: '属性（管理策タイプなど）は必ず使わないといけませんか。',
          answer:
            '属性の利用は必須ではありません。属性は管理策を別の観点で並べ替えて分析するための仕組みで、自組織で独自の属性を追加することもできます。使わずにテーマ別の分類だけで運用しても差し支えありませんが、経営層への説明で予防・検知・是正のバランスを示したいときなどには便利です。',
        },
        {
          question: 'ISO27002は購入する必要がありますか。',
          answer:
            '認証の要求事項はISO/IEC 27001側にあるため、27002がなければ認証を受けられないというものではありません。ただし各管理策の実装の手引きは27002に書かれているため、自社で解釈しながら構築を進める場合は手元にある方が判断が早くなります。日本語で参照したい場合はJIS版が対応します。購入の要否は、外部の支援を受けるかどうかも含めて判断してください。',
        },
        {
          question: '2013年版からの移行期限はどうなっていますか。',
          answer:
            '一般に公表されている情報として、ISO/IEC 27001:2013に基づく認証は2025年10月31日をもって有効期限を迎えました。現時点で新規に取得する場合も、既存の認証を維持する場合も、2022年版が前提になります。個別の認証の状況や移行審査の扱いについては、契約している認証機関の案内を確認してください。',
        },
      ],
      keywords: [
        'ISO27001 附属書A 一覧',
        '附属書A 93 管理策',
        'ISO27001 2022 管理策 一覧',
        '附属書A 変更点 2013 2022',
        'ISO27002 2022',
        '適用宣言書 SoA',
        '新設 管理策 11',
        'ISMS 管理策',
      ],
    },
    en: {
      title: 'ISO 27001:2022 Annex A Controls: All 93 Across 4 Themes, and What Changed from 2013',
      metaTitle: 'ISO 27001:2022 Annex A Controls List (All 93)',
      description:
        'All 93 Annex A controls of ISO/IEC 27001:2022 by theme: 37 organizational, 8 people, 14 physical, 34 technological, plus the 11 new controls and SoA use.',
      lead:
        'Annex A of ISO/IEC 27001:2022 contains 93 controls arranged into four themes: 37 organizational, 8 people, 14 physical and 34 technological. Eleven of them are new in the 2022 revision. The part most often misread is what Annex A is for. It is not a menu you pick from. You determine the controls you need through risk treatment, and then compare that set against Annex A to verify that nothing has been overlooked. That comparison is what clause 6.1.3 c) asks for. Reverse the order and you end up implementing controls to fill in a table. This guide lists all 93 by theme, covers what changed from the 2013 edition, and explains how the list feeds your Statement of Applicability.',
      blocks: [
        {
          type: 'h2',
          id: 'what-is-annex-a',
          text: 'What Annex A is, and how ISO 27001 relates to ISO 27002',
        },
        {
          type: 'p',
          text: 'Annex A is part of ISO/IEC 27001:2022 itself: a reference set of information security controls. It is **normative**, which means it is the list you are expected to check your own set against. How to implement each control is not covered there. That guidance lives in a separate standard, ISO/IEC 27002:2022, which is **guidance** rather than a certification requirement.',
        },
        {
          type: 'p',
          text: 'The distinction drives the order of work. First, risk assessment and risk treatment determine which controls your organization needs; see [how to run an ISMS risk assessment](/guide/isms-risk-assessment). Second, you compare that set against Annex A to confirm nothing was missed. Only then does 27002 become useful, as a source of implementation approaches and examples.',
        },
        {
          type: 'callout',
          title: 'Compare against Annex A, do not shop from it',
          text: 'Reading the 93 controls top to bottom and mapping each one onto your company looks efficient, but it forces you to invent the link back to risk afterwards. You end up with controls that no risk explains, and risks that no control addresses. Decide the controls first; use Annex A as the completeness check.',
        },
        {
          type: 'h2',
          id: 'changes-from-2013',
          text: 'What changed from the 2013 edition: 114 to 93, 14 domains to 4 themes',
        },
        {
          type: 'p',
          text: 'The 2013 Annex A had 114 controls across 14 domains. The 2022 edition has 93 across 4 themes. The count dropped because overlapping controls were merged, not because the expectations were relaxed. With coarser grouping, each individual control now covers more ground.',
        },
        {
          type: 'table',
          headers: ['Aspect', '2013 edition', '2022 edition'],
          rows: [
            ['Number of controls', '114', '93'],
            ['Grouping', '14 domains (A.5 to A.18)', '4 themes (5 to 8)'],
            ['Theme split', 'Domain based, e.g. access control, cryptography', '37 organizational / 8 people / 14 physical / 34 technological'],
            ['New controls', '—', '11'],
            ['Attributes', 'None', 'Five attribute types assigned'],
          ],
        },
        {
          type: 'p',
          text: 'The 11 new controls track how work and technology actually changed over the last decade: cloud, remote work, log monitoring and day-to-day engineering practice. They are 5.7 threat intelligence, 5.23 information security for use of cloud services, 5.30 ICT readiness for business continuity, 7.4 physical security monitoring, 8.9 configuration management, 8.10 information deletion, 8.11 data masking, 8.12 data leakage prevention, 8.16 monitoring activities, 8.23 web filtering and 8.28 secure coding. For a company that builds or runs SaaS, most of these already exist in some form. The work is usually describing an existing practice as a control rather than inventing one.',
        },
        {
          type: 'p',
          text: 'The other change is **attributes**. Each 2022 control carries five: control type (preventive, detective, corrective), information security properties (confidentiality, integrity, availability), cybersecurity concepts (identify, protect, detect, respond, recover), operational capabilities, and security domains. They exist so you can re-sort and analyse the control set from a different angle. Using them is not itself a requirement.',
        },
        {
          type: 'h2',
          id: 'organizational-controls',
          text: 'Organizational controls (5.1 to 5.37)',
        },
        {
          type: 'p',
          text: 'At 37 items this is the largest theme, spanning policy, roles, supplier management, incident handling and legal compliance. Much of what was spread across several 2013 domains now sits here. It is also the theme that generates the most documentation; for the full picture see [required ISMS documents](/guide/isms-required-documents).',
        },
        controlTable('organizational', 'en', EN_HEADERS, EN_MARK),
        {
          type: 'h2',
          id: 'people-controls',
          text: 'People controls (6.1 to 6.8)',
        },
        {
          type: 'p',
          text: 'Eight controls covering the employment lifecycle. The count is small, but these overlap with employment terms, onboarding and offboarding, so IT cannot own them alone. Remote working now being a control of its own is where practice most often differs from the 2013 edition.',
        },
        controlTable('people', 'en', EN_HEADERS, EN_MARK),
        {
          type: 'h2',
          id: 'physical-controls',
          text: 'Physical controls (7.1 to 7.14)',
        },
        {
          type: 'p',
          text: 'Entry management, equipment, storage media and disposal. Even a company with no server room of its own still has office entry, laptops leaving the building, and returns and disposal to account for. Which items apply depends heavily on how you drew your scope.',
        },
        controlTable('physical', 'en', EN_HEADERS, EN_MARK),
        {
          type: 'h2',
          id: 'technological-controls',
          text: 'Technological controls (8.1 to 8.34)',
        },
        {
          type: 'p',
          text: 'Thirty-four controls, the second largest theme, holding 7 of the 11 new ones. Access control, cryptography, logging, networks and the development life cycle are covered here, and for an engineering organization most of it overlaps with rules you already run.',
        },
        controlTable('technological', 'en', EN_HEADERS, EN_MARK),
        {
          type: 'h2',
          id: 'soa-usage',
          text: 'Using Annex A in the Statement of Applicability',
        },
        {
          type: 'p',
          text: 'All 93 controls converge in the Statement of Applicability required by clause 6.1.3 d). It is usually built as a 93-row table, with each row carrying the following.',
        },
        {
          type: 'ol',
          items: [
            'Control number and name, with every one of the 93 present as a row',
            'Whether the control is applicable',
            'Justification for inclusion: which risk treatment led to it, or which legal, contractual or internal requirement did',
            'Justification for exclusion, stated in terms of your activities rather than convenience',
            'Implementation status, with a pointer to the document or record that evidences it',
          ],
        },
        {
          type: 'p',
          text: 'What auditors tend to probe is whether you can **move in both directions between the risk treatment plan and the SoA**. A control chosen in treatment but marked not applicable, or marked applicable with no document or record behind it, stands out quickly. Exclusions written as a bare "not applicable" are weak; say why the activity does not occur in your organization.',
        },
        {
          type: 'p',
          text: 'Whether a control can be excluded follows from the risk assessment. A company that writes no software of its own may reasonably exclude development controls, but if development is outsourced then 8.30 outsourced development comes back into play. The test is not "we do not use it" but "this activity does not occur in our scope".',
        },
        {
          type: 'h2',
          id: 'priority-for-smb',
          text: 'Controls smaller IT companies often start with',
        },
        {
          type: 'p',
          text: 'Priority properly comes out of your risk assessment, and there is no universal ordering. That said, as a general pattern, IT companies up to around 100 staff tend to start in the following areas, largely because existing practice already supplies most of the implementation.',
        },
        {
          type: 'ul',
          items: [
            '5.15 / 5.18 / 8.2 access rights and privileged access — starts with a SaaS account inventory and ties into joiner and leaver processes',
            '5.9 / 5.10 asset inventory and acceptable use — without knowing what you protect, other controls have no basis to cite',
            '5.23 information security for use of cloud services — write down how SaaS is selected, contracted and exited',
            '8.8 management of technical vulnerabilities — define the path from detection to patching for dependencies and operating systems',
            '8.15 / 8.16 logging and monitoring — begin by deciding who looks at the logs you already collect, and when',
            '6.3 awareness, education and training — shape it so an annual record actually exists',
            '5.24 to 5.27 incident management — build a reporting path that captures minor events too',
          ],
        },
        {
          type: 'p',
          text: 'Conversely, the heavier early lifts tend to be new controls that may imply tooling, such as 8.11 data masking and 8.12 data leakage prevention. How far these need to go varies sharply with the data you hold, so decide from the risk assessment. For the overall route to certification, see [how ISO 27001 certification works](/guide/iso27001-certification-process).',
        },
        {
          type: 'h2',
          id: 'managing-with-tools',
          text: 'Managing 93 controls with tooling',
        },
        {
          type: 'p',
          text: 'The list itself is fine in a spreadsheet. The cost appears when you maintain the links between risks, controls, the SoA, documents and records. Tracing by eye which SoA rows and which documents a single updated risk touches stops being realistic once there are 93 controls in play.',
        },
        {
          type: 'p',
          text: 'Holding those links in a tool makes the ripple of an update traceable and makes empty justification fields visible. If you first want to see how much of the 93 you can currently explain, start from the [ISMS readiness self-check](/research).',
        },
      ],
      faq: [
        {
          question: 'Do we have to implement all 93 controls?',
          answer:
            'No. Applicability follows from risk assessment and risk treatment, and controls that do not apply to your organization can be excluded in the Statement of Applicability. Exclusions do need a stated justification, and you need to show that all 93 were considered. The problem is not excluding a control; it is having controls nobody ever looked at.',
        },
        {
          question: 'Is there a mapping table between the 2013 and 2022 controls?',
          answer:
            'ISO/IEC 27002:2022 includes annexed tables mapping old control numbers to new ones. The relationship is not always one to one: several 2013 controls were merged into one, and some single controls now span more than one entry. If you built your ISMS on the older edition, walking that mapping to see where your existing documents land is usually the fastest way to plan the transition.',
        },
        {
          question: 'Are the attributes mandatory?',
          answer:
            'No. Attributes are an optional way to re-sort and analyse controls, and you can add your own. Running purely on the four themes is fine. They become useful when you want to show management the balance between preventive, detective and corrective controls.',
        },
        {
          question: 'Do we need to buy ISO 27002?',
          answer:
            'Certification requirements sit in ISO/IEC 27001, so 27002 is not a precondition for being certified. It does hold the implementation guidance for each control, so if you are building the system yourselves it usually speeds up interpretation to have a copy. Whether to purchase it depends partly on whether you are working with outside support.',
        },
        {
          question: 'What was the transition deadline from the 2013 edition?',
          answer:
            'As generally published information, certificates based on ISO/IEC 27001:2013 reached the end of their validity on 31 October 2025. New certifications and ongoing maintenance now proceed against the 2022 edition. For the status of a specific certificate or how a transition audit is handled, check with the certification body you hold the contract with.',
        },
      ],
      keywords: [
        'ISO 27001 Annex A controls list',
        'Annex A 93 controls',
        'ISO 27001 2022 controls',
        'Annex A changes 2013 2022',
        'ISO 27002 2022',
        'Statement of Applicability',
        '11 new controls',
        'ISMS controls',
      ],
    },
    zh: {
      title: 'ISO27001:2022 附录A控制措施清单｜四大主题93项与2013版变更点',
      metaTitle: 'ISO27001附录A控制措施清单｜93项与变更点',
      description:
        '按组织37项、人员8项、物理14项、技术34项四大主题，完整列出ISO/IEC 27001:2022附录A的93项控制措施，并梳理2013版114项的合并情况、新增的11项控制措施以及适用性声明中的使用方式。',
      lead:
        'ISO/IEC 27001:2022附录A包含四大主题共93项控制措施：组织37项、人员8项、物理14项、技术34项，其中11项为2022版新增。最容易被误解的是附录A的定位。它并不是一份可以随意挑选的菜单，而是在风险处置中确定了所需控制措施之后，用来核对是否有遗漏的参照清单。第6.1.3 c)条要求的正是这一比对，顺序一旦颠倒，就容易变成「为了填表而做的措施」。本文按四大主题列出全部93项，并梳理2013版以来的变更以及适用性声明中的使用方式。',
      blocks: [
        {
          type: 'h2',
          id: 'what-is-annex-a',
          text: '附录A是什么（ISO27001与ISO27002的关系）',
        },
        {
          type: 'p',
          text: '附录A是ISO/IEC 27001:2022的组成部分，是一份信息安全控制措施参照清单，属于**规范性**内容，用于核对自身选定的控制措施是否有遗漏。至于每项控制措施如何实施，并未写在该标准中，而是由另一份标准ISO/IEC 27002:2022承担，它属于**指南**，本身不是认证审核准则。',
        },
        {
          type: 'p',
          text: '这一区别直接决定了工作顺序。首先通过风险评估与风险处置确定本组织所需的控制措施（步骤见[ISMS风险评估](/guide/isms-risk-assessment)）；其次把这份清单与附录A比对，确认没有遗漏的领域；最后才翻开27002，参考实施思路与示例。',
        },
        {
          type: 'callout',
          title: '附录A用来「核对」，不是用来「挑选」',
          text: '从93项逐条往下读、再套到自己公司的做法看似高效，实际上是事后补建与风险的对应关系，结果往往是既有说不清风险的措施，也有没有措施对应的风险。请先确定所需控制措施，把附录A留作查漏的验证工具。',
        },
        {
          type: 'h2',
          id: 'changes-from-2013',
          text: '2013版以来的变更（114项变93项，14个领域变4个主题）',
        },
        {
          type: 'p',
          text: '2013版附录A为14个领域114项控制措施，2022版调整为4个主题93项。数量减少并非要求放松，而是内容重叠的控制措施被合并。分类粒度变粗之后，单项控制措施覆盖的范围相应变宽。',
        },
        {
          type: 'table',
          headers: ['对比项', '2013版', '2022版'],
          rows: [
            ['控制措施数量', '114', '93'],
            ['分类', '14个领域（A.5至A.18）', '4个主题（第5至8章）'],
            ['主题构成', '按访问控制、密码等领域划分', '组织37／人员8／物理14／技术34'],
            ['新增', '—', '11项'],
            ['属性', '无', '赋予5类属性'],
          ],
        },
        {
          type: 'p',
          text: '新增的11项对应近十年已成常态的工作方式与技术，包括云服务使用、远程办公、日志监视以及开发现场实务，具体为5.7 威胁情报、5.23 使用云服务的信息安全、5.30 业务连续性的ICT就绪、7.4 物理安全监视、8.9 配置管理、8.10 信息删除、8.11 数据脱敏、8.12 数据泄露防护、8.16 监视活动、8.23 网络过滤、8.28 安全编码。对开发或使用SaaS的IT企业而言，多数领域其实已在以某种形式运行，工作重点通常是把既有做法表述为控制措施，而非从零搭建。',
        },
        {
          type: 'p',
          text: '另一项变更是**属性**。2022版为每项控制措施赋予5类属性：控制措施类型（预防／检测／纠正）、信息安全特性（保密性／完整性／可用性）、网络安全概念（识别／保护／检测／响应／恢复）、运行能力、安全域。其作用是从不同角度重新排序与分析控制措施，按属性分类本身并非要求事项。',
        },
        {
          type: 'h2',
          id: 'organizational-controls',
          text: '组织控制措施（5.1至5.37）清单',
        },
        {
          type: 'p',
          text: '共37项，是数量最多的主题，涵盖方针、职责、供应商管理、事件响应与合规。2013版中分散在多个领域的控制措施被集中到这里。该主题需要编制的文件也最多，整体清单见[ISMS所需文件一览](/guide/isms-required-documents)。',
        },
        controlTable('organizational', 'zh', ZH_HEADERS, ZH_MARK),
        {
          type: 'h2',
          id: 'people-controls',
          text: '人员控制措施（6.1至6.8）清单',
        },
        {
          type: 'p',
          text: '涵盖从招聘到离职的人员相关控制措施。虽然只有8项，但与劳动规章、雇佣合同、入离职手续重叠，信息系统部门无法独立完成。远程办公成为独立的控制措施，是与2013版在实务上差异最明显之处。',
        },
        controlTable('people', 'zh', ZH_HEADERS, ZH_MARK),
        {
          type: 'h2',
          id: 'physical-controls',
          text: '物理控制措施（7.1至7.14）清单',
        },
        {
          type: 'p',
          text: '涵盖出入管理、设备、存储介质直至处置。即使不自建机房、完全使用云服务的企业，办公室出入、公司电脑的携出、归还与报废仍在范围之内。适用范围的划定方式不同，涉及的条目也会变化。',
        },
        controlTable('physical', 'zh', ZH_HEADERS, ZH_MARK),
        {
          type: 'h2',
          id: 'technological-controls',
          text: '技术控制措施（8.1至8.34）清单',
        },
        {
          type: 'p',
          text: '共34项，是数量第二多的主题，11项新增中有7项在此。涵盖访问控制、密码技术、日志、网络与开发生命周期，对IT企业而言与既有开发运维规则的重叠程度较高。',
        },
        controlTable('technological', 'zh', ZH_HEADERS, ZH_MARK),
        {
          type: 'h2',
          id: 'soa-usage',
          text: '适用性声明（SoA）中的使用方式',
        },
        {
          type: 'p',
          text: '附录A的93项控制措施最终汇集于第6.1.3 d)条要求的适用性声明（SoA）。SoA通常做成93行的表格，每行包含以下信息。',
        },
        {
          type: 'ol',
          items: [
            '控制措施编号与名称（附录A全部93项均需成行）',
            '是否适用的判定',
            '适用理由（来自哪项风险处置，或源于法律法规、合同、内部方针）',
            '不适用时的理由（需结合本组织活动说明为何不涉及）',
            '实施状况，以及支撑实施的文件或记录的索引',
          ],
        },
        {
          type: 'p',
          text: '审核时容易被追问的是**风险处置计划与SoA之间能否双向对应**。风险处置中选定的控制措施在SoA中却标为不适用，或标为适用却找不到对应文件与记录，这类不一致很容易被发现。不适用的理由仅写「无此项」说服力不足，需要结合自身业务说明为何不涉及。',
        },
        {
          type: 'p',
          text: '能否排除取决于风险评估结果。例如不自行开发软件的企业可以合理排除开发类控制措施，但若采用外包开发，8.30 外包开发仍会涉及。判断标准不是「我们没用」，而是「本组织范围内不存在该活动」。',
        },
        {
          type: 'h2',
          id: 'priority-for-smb',
          text: '中小IT企业通常优先着手的控制措施示例',
        },
        {
          type: 'p',
          text: '优先顺序本应由风险评估结果决定，并无统一答案。作为一般性倾向，百人规模以内的IT企业常从以下领域入手，因为既有做法本身就能构成实施状况，新增负担相对较小。',
        },
        {
          type: 'ul',
          items: [
            '5.15／5.18／8.2 访问权限与特权管理 — 以SaaS账号盘点为起点，并与入离职手续联动',
            '5.9／5.10 信息资产清单与可接受使用 — 不先确定保护对象，其他控制措施就缺少依据',
            '5.23 使用云服务的信息安全 — 把在用SaaS的选型、签约与退出思路写成文字',
            '8.8 技术脆弱性管理 — 为依赖库与操作系统确定从发现到修补的流程',
            '8.15／8.16 日志记录与监视活动 — 先就已采集的日志确定由谁在何时查看',
            '6.3 信息安全意识、教育与培训 — 做成每年能留下实施记录的形式',
            '5.24至5.27 事件管理 — 建立包含轻微事态在内的上报通道',
          ],
        },
        {
          type: 'p',
          text: '相反，初期负担较重的往往是可能需要引入工具的新增控制措施，如8.11 数据脱敏与8.12 数据泄露防护。其必要程度因所处理信息的性质差异很大，应结合风险评估结果判断。取证的整体流程见[ISO27001认证取得流程](/guide/iso27001-certification-process)。',
        },
        {
          type: 'h2',
          id: 'managing-with-tools',
          text: '用工具管理93项控制措施',
        },
        {
          type: 'p',
          text: '仅仅列出93项清单，用电子表格就足够。负担出现在把风险、控制措施、SoA、文件与记录相互关联并持续维护的环节。当控制措施多达93项时，仅凭人工核对一次风险更新会波及哪些SoA行与哪些文件，很难长期维持。',
        },
        {
          type: 'p',
          text: '把这些关联交给工具承载，更新的波及范围可被自动追踪，适用与不适用理由仍为空白的行也更容易被发现。若想先确认本公司对93项中的哪些已能说明清楚，可以从[ISMS现状自检](/research)开始。',
        },
      ],
      faq: [
        {
          question: '93项控制措施必须全部实施吗？',
          answer:
            '不必全部实施。是否实施由风险评估与风险处置结果决定，与本组织无关的控制措施可在适用性声明中排除。但排除需要写明理由，并且需要留下对全部93项都逐一考虑过的证据。问题不在于排除，而在于存在从未被审视过的条目。',
        },
        {
          question: '有2013版与2022版的对照表吗？',
          answer:
            'ISO/IEC 27002:2022附有新旧控制措施编号的对照表。二者并非都是一一对应，有的是多项旧控制措施合并为一项，也有一项跨到多项。基于旧版已建立体系的组织，沿着该对照关系梳理既有文件对应到哪个新编号，通常是推进转版最快的方式。',
        },
        {
          question: '属性（控制措施类型等）是必须使用的吗？',
          answer:
            '并非必须。属性是从不同角度重新排序与分析控制措施的手段，组织也可自行增加属性。仅按四大主题分类运行并无问题。当需要向管理层说明预防、检测与纠正之间的平衡时，属性会比较有用。',
        },
        {
          question: '必须购买ISO27002吗？',
          answer:
            '认证要求位于ISO/IEC 27001一侧，没有27002并不意味着无法通过认证。但各项控制措施的实施指南写在27002中，若由自身团队边解释边建设，手边有一份通常能加快判断。是否购买，可结合是否借助外部支持一并考虑。',
        },
        {
          question: '2013版的转版期限是怎样的？',
          answer:
            '按一般公开信息，基于ISO/IEC 27001:2013的认证证书已于2025年10月31日到期。目前无论新取得还是维持既有认证，都以2022版为前提。具体证书的状态与转版审核的处理方式，请向签约的认证机构确认。',
        },
      ],
      keywords: [
        'ISO27001 附录A 清单',
        '附录A 93项 控制措施',
        'ISO27001 2022 控制措施 清单',
        '附录A 变更点 2013 2022',
        'ISO27002 2022',
        '适用性声明 SoA',
        '新增 控制措施 11项',
        'ISMS 控制措施',
      ],
    },
  },
};
