import type { GuideArticle } from '../types';

export const ismsRiskAssessment: GuideArticle = {
  slug: 'isms-risk-assessment',
  publishedAt: '2026-09-10',
  updatedAt: '2026-09-10',
  related: ['iso27001-certification-process', 'isms-required-documents', 'isms-certification-cost'],
  content: {
    ja: {
      title: 'ISMSリスクアセスメントのやり方｜情報資産の洗い出しから適用宣言書まで6ステップ',
      metaTitle: 'ISMSリスクアセスメントのやり方｜6ステップと表の例',
      description:
        'ISO/IEC 27001のリスクアセスメント手順を、リスク基準の定義・情報資産の洗い出し・分析・評価・リスク対応と適用宣言書まで6ステップで解説。評価基準の表の例とよくある失敗もまとめました。',
      lead:
        'ISMSのリスクアセスメントは、情報資産を並べて危なそうなものに印を付ける作業ではありません。ISO/IEC 27001:2022 は、箇条 6.1.2 でリスクアセスメントのプロセスを定めること、6.1.3 でリスク対応のプロセスと適用宣言書（SoA）を作ること、箇条 8.2 と 8.3 でそれらを計画した間隔で実施し結果を文書化した情報として保持することを求めています。実務の順序は、①リスク基準の定義 ②情報資産の洗い出し ③脅威と脆弱性の特定 ④リスク分析 ⑤リスク評価 ⑥リスク対応の6ステップです。先に基準を決めてから資産を並べる、という順番さえ守れば、あとは埋めていく作業になります。',
      blocks: [
        { type: 'h2', id: 'risk-assessment-in-iso27001', text: 'リスクアセスメントはISO/IEC 27001のどこに位置づくか' },
        {
          type: 'p',
          text: 'リスクアセスメントは、ISMSの中で「何を守るか」と「どの管理策を入れるか」をつなぐ唯一の橋です。管理策を先に決めて理由を後付けすると、審査で根拠を問われます。規格が求めているのは次の4点です。',
        },
        {
          type: 'ul',
          items: [
            '**箇条 6.1.2（情報セキュリティリスクアセスメント）** — リスク受容基準と実施基準を定め、一貫性があり比較可能で妥当な結果を出せるプロセスにすること。リスクの特定・分析・評価と、リスク所有者の特定を含みます。',
            '**箇条 6.1.3（情報セキュリティリスク対応）** — 対応の選択肢を選び、必要な管理策を決め、附属書Aと照合して見落としを確認し、**適用宣言書（SoA）** を作成すること。リスク対応計画と残留リスクは、リスク所有者の承認が必要です。',
            '**箇条 8.2 / 8.3** — 計画した間隔で、また重大な変化があった場合にアセスメントを実施し、対応計画を実行して、結果を文書化した情報として保持すること。',
            '**附属書A** — 93の管理策の参照リスト。ここから選ぶのではなく、決めた管理策の抜け漏れを照合する一覧として使います。',
          ],
        },
        {
          type: 'p',
          text: '認証取得までの全体の流れは[ISO27001認証取得の進め方](/guide/iso27001-certification-process)で扱っています。着手は適用範囲の決定の直後、管理策の実装より前が定石です。',
        },

        { type: 'h2', id: 'step1-risk-criteria', text: 'ステップ1: リスク基準（受容基準・評価基準）を先に定義する' },
        {
          type: 'p',
          text: '最初に決めるのは資産ではなく基準です。基準がないまま資産を並べ始めると担当者ごとに評価がぶれ、後からすべて付け直すことになります。決めるのは、発生可能性の尺度、影響度の尺度、スコアの計算方法、リスク受容基準の4つ。中小規模の組織なら3段階で十分に運用できます。',
        },
        {
          type: 'table',
          headers: ['発生可能性 / 影響度', '軽微（1）', '中程度（2）', '重大（3）'],
          rows: [
            ['高（3）／年数回以上', '3：中リスク', '6：高リスク', '9：最高リスク'],
            ['中（2）／数年に1回', '2：低リスク', '4：中リスク', '6：高リスク'],
            ['低（1）／めったに起きない', '1：低リスク', '2：低リスク', '3：中リスク'],
          ],
        },
        {
          type: 'p',
          text: '影響度は、機密性・完全性・可用性（CIA）が損なわれたときの事業影響で測ります。「顧客データの外部流出は重大（3）」のような判断例を基準書に併記すると評価がぶれません。**リスク受容基準**も「スコア3以下は受容、4以上は対応を検討」のように数値で明文化します。',
        },
        {
          type: 'callout',
          title: '受容基準は経営層が決める',
          text: 'どこまでのリスクを受け入れるかは技術判断ではなく経営判断です。受容基準の数値を情報システム担当者だけで決めると、残留リスクの承認段階で覆り、評価をやり直すことになります。ステップ1で経営層の合意を取るのが最短経路です。',
        },

        { type: 'h2', id: 'step2-asset-inventory', text: 'ステップ2: 情報資産を洗い出して資産台帳を作る' },
        {
          type: 'p',
          text: '次に、適用範囲の中にある情報資産を洗い出します。対象はデータだけでなく、それを保持・処理する仕組みや、扱う人・場所も含みます。台帳には最低限、次の項目を持たせます。',
        },
        {
          type: 'table',
          headers: ['項目', '内容', '記入例'],
          rows: [
            ['資産名', '識別できる名称。曖昧な総称にしない', '顧客管理SaaS（CRM）の顧客マスタ'],
            ['資産分類', '情報／ソフトウェア／物理／サービス／人的の区分', '情報'],
            ['資産所有者', '管理責任を持つ役割。個人名より役割名', '営業部長'],
            ['保管場所・媒体', '所在。クラウドはサービス名とリージョンまで', 'クラウド（SaaS事業者A・国内リージョン）'],
            ['重要度（C・I・A）', '機密性・完全性・可用性を3段階で評価', 'C:3 / I:3 / A:2'],
            ['取扱区分', '機密／社外秘／公開などの分類ラベル', '機密'],
          ],
        },
        {
          type: 'p',
          text: '粒度が分かれ目です。ファイル1本ずつ数えると数千件になって運用できず、「社内システム」とまとめると粗すぎて管理策に落とせません。目安は**業務システム単位・データベース単位・共有フォルダ単位**で、〜100名規模なら50〜150件程度です。資産台帳は認証で求められる文書でもあり、[ISMSで必要な文書一覧](/guide/isms-required-documents)と合わせて整理すると効率的です。',
        },

        { type: 'h2', id: 'step3-threats-and-vulnerabilities', text: 'ステップ3: 脅威と脆弱性を特定する（資産ベースと事象ベース）' },
        {
          type: 'p',
          text: 'リスクの特定には大きく2つのアプローチがあり、ISO/IEC 27001:2022 はどちらも強制しません。実務では併用が現実的です。',
        },
        {
          type: 'ul',
          items: [
            '**資産ベースアプローチ** — 資産ごとに「脅威（何が起こりうるか）」と「脆弱性（なぜ起こりうるか）」を組み合わせます。例: 顧客マスタ × 権限設定の誤り × 退職者アカウントの残存 → 不正閲覧。網羅性が高い反面、件数が膨らみやすいのが弱点です。',
            '**事象ベース（シナリオベース）アプローチ** — 「ランサムウェアで基幹システムが停止する」のように、起こりうる事象から出発します。件数を抑えられ経営層に説明しやすい反面、抜け漏れの確認に別途チェックリストが要ります。',
            '**併用の型** — 資産台帳で網羅性を担保しつつ、影響の大きい事象（サプライチェーン、内部不正、災害、クラウド事業者の障害）をシナリオとして別立てで追加します。',
          ],
        },
        {
          type: 'p',
          text: 'このとき、各リスクに**リスク所有者**を必ず割り当てます。規格が求めているのは資産の所有者ではなくリスクの所有者で、対応方針を決め残留リスクを承認する役割です。実務上は部門長クラスです。',
        },

        { type: 'h2', id: 'step4-5-analysis-and-evaluation', text: 'ステップ4・5: リスク分析と評価で優先順位を決める' },
        {
          type: 'p',
          text: 'ステップ1で決めた尺度を使い、各リスクに発生可能性と影響度を付けてスコアを算出します。分析では、既存の管理策が効いている状態（現状リスク）を評価するのが原則です。何も対策していない前提で評価すると、全件が最高リスクになって優先順位が付きません。',
        },
        {
          type: 'p',
          text: '評価では、スコアを受容基準と突き合わせて対応が必要なリスクを選びます。同じスコアが並んだときは、法令・契約上の要求の有無、事業継続への影響、対応コストの順で判断します。ここまでの結果が**リスクアセスメント表**として残ります。',
        },

        { type: 'h2', id: 'step6-risk-treatment', text: 'ステップ6: リスク対応の4つの選択肢と附属書A管理策の選択' },
        {
          type: 'p',
          text: '対応が必要と判断したリスクごとに、次の4つから方針を選びます。すべてを低減で埋める必要はなく、受容や移転を選んだ理由が記録されていることが重要です。',
        },
        {
          type: 'table',
          headers: ['対応方針', '内容', '例'],
          rows: [
            ['低減（軽減）', '管理策を追加して発生可能性か影響度を下げる', 'アクセス権限の四半期棚卸しと多要素認証の導入'],
            ['回避', 'リスクの原因となる活動そのものをやめる', '業務上不要な個人データの保持をやめ、収集項目から削除'],
            ['移転（共有）', '契約や保険で他者と分担する', 'サイバー保険への加入、委託契約へのセキュリティ要件の明記'],
            ['受容（保有）', '基準内と判断してそのまま保持する', 'スコア2の社内資料の可用性低下をリスク所有者が承認'],
          ],
        },
        { type: 'h3', id: 'soa-and-risk-treatment-plan', text: '適用宣言書（SoA）とリスク対応計画' },
        {
          type: 'p',
          text: '方針が決まったら必要な管理策を決定し、附属書Aの93管理策と照合して見落としがないかを確認します。そのうえで作るのが**適用宣言書（SoA）**です。適用する管理策とその根拠、実装状況、適用しない管理策の除外理由を記載します。「適用しない」と書くこと自体は問題ではなく、理由がアセスメント結果と整合していることが必要です。',
        },
        {
          type: 'ol',
          items: [
            'リスク対応の方針（低減・回避・移転・受容）をリスクごとに決定する',
            '低減を選んだリスクについて、必要な管理策を具体的に決める',
            '決めた管理策を附属書Aと照合し、見落とした領域がないか確認する',
            '適用宣言書（SoA）に、適用する管理策・根拠・実装状況・除外理由を記載する',
            'リスク対応計画に、実施事項・責任者・期限・必要な資源を落とし込む',
            '残留リスクを算定し、リスク対応計画とあわせてリスク所有者の承認を得る',
          ],
        },
        { type: 'h3', id: 'residual-risk-approval', text: '残留リスクの承認と見直しの頻度' },
        {
          type: 'p',
          text: '管理策を入れても残るリスクが残留リスクです。再評価して受容基準の範囲内であることを確認し、リスク所有者の承認を記録に残します。承認の記録がないまま運用に入るのは、指摘されやすい典型パターンです。見直しは**年1回以上**を計画的に行い、加えて新システムの導入、事業所の移転、重大なインシデント、委託先の変更時に再評価します。全体の工数感は[ISMS認証取得の費用](/guide/isms-certification-cost)で整理しています。',
        },

        { type: 'h2', id: 'common-pitfalls', text: 'よくある失敗と実務のコツ' },
        {
          type: 'ul',
          items: [
            '**資産を挙げすぎる** — ファイル単位で数百件を超えると、年1回の見直しが回らなくなります。システム・データベース・共有フォルダ単位に丸めるのが実務的です。',
            '**基準が曖昧でスコアがぶれる** — 「影響度：中」の判断例を書いていないと、担当者が変わった翌年に同じ資産のスコアが変わります。基準書に判断例を必ず添えます。',
            '**SoAとリスクアセスメント表の不整合** — SoAで「適用する」とした管理策が、対応計画のどのリスクにもひも付いていないケース。両者は相互参照できる形にします。',
            '**リスク所有者が担当者になっている** — 承認権限のない担当者を所有者にすると、残留リスクの承認が形骸化します。決裁できる役割を割り当てます。',
          ],
        },

        { type: 'h2', id: 'managing-with-tools', text: '台帳とマトリクスをツールで管理する' },
        {
          type: 'p',
          text: 'ここまでの成果物は、資産台帳・リスクアセスメント表・SoA・リスク対応計画の4つで、いずれも相互に参照し合います。Excelでも始められますが、資産が100件を超えると、台帳の更新がSoAに反映されない、同時編集で版が分かれる、評価をいつ誰が変えたか示せない、といった問題が出てきます。',
        },
        {
          type: 'p',
          text: '4つを同じデータとしてつなぎ、変更履歴と承認記録が自動で残る形にしておくと、年1回の見直しが棚卸しではなく差分の確認で済みます。Riscala AI for ISMS はこの形の管理を提供します。まず自社がどのステップまで進んでいるかを確かめたい場合は、[ISMS現在地セルフチェック](/research)から着手状況を整理してみてください。',
        },
      ],
      faq: [
        {
          question: '資産ベースと事象ベース、どちらのアプローチを選ぶべきですか？',
          answer:
            'ISO/IEC 27001:2022 はどちらかを指定していないため、組織が説明できる方法であれば問題ありません。〜100名規模では、資産ベースで網羅性を担保しつつ、ランサムウェアや委託先経由の漏えいなど影響の大きい事象をシナリオとして追加する併用型が扱いやすいです。資産台帳をすでに持っている組織は資産ベースから、クラウド中心で自社資産が少ない組織は事象ベースから始めると立ち上がりが早くなります。',
        },
        {
          question: '情報資産は何件くらい挙げればよいですか？',
          answer:
            '規格に件数の定めはありません。実務の目安として、〜100名規模のIT企業であれば業務システム単位・データベース単位・共有フォルダ単位に丸めて50〜150件程度です。数百件を超えると年1回の見直しが現実的に回らなくなるため、件数が膨らんだ場合は粒度を上げて統合することを検討します。逆に10件程度に収まっている場合は、委託先や紙媒体、要員に関する資産が抜けていないか確認してください。',
        },
        {
          question: 'リスクアセスメントはどのくらいの頻度で実施しますか？',
          answer:
            '箇条 8.2 は、あらかじめ定めた間隔で、また重大な変更が提案されたか発生した場合に実施することを求めています。実務では年1回の定期見直しを年間計画に組み込み、加えて新システムの導入、事業所や適用範囲の変更、重大なインシデントの発生、主要な委託先の変更があったときに、その範囲について随時再評価する運用が一般的です。',
        },
        {
          question: 'Excelでリスクアセスメントを管理しても問題ありませんか？',
          answer:
            '規格上、形式の指定はないためExcelでも要求は満たせます。初回の取得時はExcelで始める組織が多数です。ただし資産が100件を超えると、資産台帳の更新が適用宣言書に反映されない、同時編集で版が分かれる、誰がいつ評価を変えたかの履歴が追えない、といった運用上の問題が出やすくなります。維持段階で工数が増えてきたタイミングが、ツールへの移行を検討する目安です。',
        },
        {
          question: 'リスク対応で「受容」を選んでも審査で問題になりませんか？',
          answer:
            '問題ありません。箇条 6.1.3 は低減以外の選択肢も認めており、受容も正当な対応方針です。重要なのは、あらかじめ定めたリスク受容基準の範囲内であること、その判断の根拠が記録されていること、リスク所有者の承認が残っていることの3点です。基準を定めずに「対応しない」とだけ書かれている状態が指摘の対象になります。',
        },
      ],
      keywords: [
        'ISMS リスクアセスメント',
        'ISO27001 リスクアセスメント 手順',
        '情報資産 洗い出し',
        'リスク評価 基準',
        'リスク対応',
        '適用宣言書',
        'リスク受容基準',
        'リスクアセスメント 表 例',
        '資産台帳',
      ],
    },
    en: {
      title: 'How to Run an ISMS Risk Assessment: 6 Steps from Asset Inventory to the Statement of Applicability',
      metaTitle: 'ISMS Risk Assessment: 6 Steps and Example Tables',
      description:
        'A practical six-step ISO/IEC 27001 risk assessment: set risk criteria, inventory assets, analyse and evaluate risk, then treat it via the SoA.',
      lead:
        'An ISMS risk assessment is not a matter of listing information assets and flagging the scary ones. ISO/IEC 27001:2022 requires you to define a risk assessment process in clause 6.1.2, define a risk treatment process and produce a Statement of Applicability (SoA) in clause 6.1.3, and then perform both at planned intervals and retain the results as documented information under clauses 8.2 and 8.3. The working order is six steps: define risk criteria, inventory information assets, identify threats and vulnerabilities, analyse risk, evaluate risk, and treat risk. Keep that order, criteria before assets, and the rest becomes a matter of filling in the sheets.',
      blocks: [
        { type: 'h2', id: 'risk-assessment-in-iso27001', text: 'Where Risk Assessment Sits in ISO/IEC 27001' },
        {
          type: 'p',
          text: 'Risk assessment is the only bridge in an ISMS between what you protect and which controls you implement. Pick controls first and reason backwards, and an auditor will ask for the justification every time. The standard asks for four things.',
        },
        {
          type: 'ul',
          items: [
            '**Clause 6.1.2 (information security risk assessment)** — define risk acceptance criteria and criteria for performing assessments, so the process produces consistent, valid and comparable results. It covers identifying, analysing and evaluating risk, and identifying risk owners.',
            '**Clause 6.1.3 (information security risk treatment)** — select treatment options, determine the necessary controls, compare them against Annex A to check nothing was overlooked, and produce a **Statement of Applicability (SoA)**. Risk owners must approve the treatment plan and the residual risks.',
            '**Clauses 8.2 / 8.3** — perform assessments at planned intervals and when significant changes occur, implement the treatment plan, and retain the results as documented information.',
            '**Annex A** — a reference list of 93 controls. It is not a menu to pick from, but a checklist you compare your determined controls against.',
          ],
        },
        {
          type: 'p',
          text: 'For the wider timeline, see our guide to [the ISO 27001 certification process](/guide/iso27001-certification-process). As a rule, start right after the scope is fixed and well before you implement controls.',
        },

        { type: 'h2', id: 'step1-risk-criteria', text: 'Step 1: Define Risk Criteria Before You Touch the Assets' },
        {
          type: 'p',
          text: 'The first thing you decide is criteria, not assets. Start listing assets without criteria and every reviewer scores differently, which means rescoring everything later. You need four things: a likelihood scale, an impact scale, a scoring method, and risk acceptance criteria. For a smaller organisation, three levels are enough.',
        },
        {
          type: 'table',
          headers: ['Likelihood / Impact', 'Minor (1)', 'Moderate (2)', 'Major (3)'],
          rows: [
            ['High (3) / several times a year', '3: Medium', '6: High', '9: Critical'],
            ['Medium (2) / once in a few years', '2: Low', '4: Medium', '6: High'],
            ['Low (1) / rarely occurs', '1: Low', '2: Low', '3: Medium'],
          ],
        },
        {
          type: 'p',
          text: 'Measure impact as the business consequence of losing confidentiality, integrity or availability (CIA). Worked examples in the criteria document, such as "customer data disclosed externally is Major (3)", keep scoring stable. State the **risk acceptance criteria** numerically too, for example "scores of 3 or below are accepted; 4 and above require treatment".',
        },
        {
          type: 'callout',
          title: 'Acceptance criteria are a management decision',
          text: 'How much risk the organisation is willing to carry is a business judgement, not a technical one. If IT alone sets the acceptance threshold, it tends to be overturned when residual risks go for approval, and the scoring has to be redone. Getting management agreement at step 1 is the shortest path.',
        },

        { type: 'h2', id: 'step2-asset-inventory', text: 'Step 2: Inventory Information Assets and Build the Asset Register' },
        {
          type: 'p',
          text: 'Next, inventory the information assets inside your scope. That means not only the data itself but the systems that hold and process it, and the people and places involved. At minimum, the register should carry these fields.',
        },
        {
          type: 'table',
          headers: ['Field', 'What it holds', 'Example entry'],
          rows: [
            ['Asset name', 'A name that identifies it; avoid vague umbrella terms', 'Customer master data in the CRM SaaS'],
            ['Asset type', 'Information / software / physical / service / people', 'Information'],
            ['Asset owner', 'The role accountable for it; a role beats a personal name', 'Head of Sales'],
            ['Location or medium', 'Where it lives; for cloud, the service and region', 'Cloud (SaaS vendor A, domestic region)'],
            ['C / I / A rating', 'Confidentiality, integrity, availability on a 3-point scale', 'C:3 / I:3 / A:2'],
            ['Classification', 'Confidential / internal / public label', 'Confidential'],
          ],
        },
        {
          type: 'p',
          text: 'Granularity is where this succeeds or fails. Counting individual files gives you thousands of rows nobody maintains; lumping everything into "internal systems" is too coarse to map to controls. A workable unit is **one business system, one database, or one shared folder**, which lands around 50 to 150 entries for an organisation of up to 100 people. The register is also a document certification expects, so organise it alongside [the ISMS documents you need](/guide/isms-required-documents).',
        },

        { type: 'h2', id: 'step3-threats-and-vulnerabilities', text: 'Step 3: Identify Threats and Vulnerabilities (Asset-Based and Event-Based)' },
        {
          type: 'p',
          text: 'There are two broad approaches to identifying risk, and ISO/IEC 27001:2022 does not mandate either. In practice, combining them works best.',
        },
        {
          type: 'ul',
          items: [
            '**Asset-based approach** — for each asset, pair a threat (what could happen) with a vulnerability (why it could happen). For example: customer master data, misconfigured permissions, dormant accounts of former employees, leading to unauthorised access. Coverage is strong, but the row count grows quickly.',
            '**Event-based (scenario) approach** — start from plausible events such as "ransomware halts the core system". Fewer entries and easier to explain to management, but you need a separate checklist to confirm nothing is missing.',
            '**Combining them** — use the asset register for coverage, then add high-impact events (supply chain, insider misuse, disaster, cloud provider outage) as separate scenarios.',
          ],
        },
        {
          type: 'p',
          text: 'Assign a **risk owner** to every risk at this point. The standard asks for owners of risks, not owners of assets: the person who decides the treatment and approves the residual risk. In practice that is department-head level.',
        },

        { type: 'h2', id: 'step4-5-analysis-and-evaluation', text: 'Steps 4 and 5: Analyse and Evaluate to Set Priorities' },
        {
          type: 'p',
          text: 'Using the scales from step 1, assign likelihood and impact to each identified risk and calculate the score. Analyse the risk as it stands with existing controls in place. Score everything as if nothing were in place and every row comes out critical, which gives you no priorities at all.',
        },
        {
          type: 'p',
          text: 'Evaluation compares those scores against the acceptance criteria and selects the risks that need treatment. When scores tie, ordering by legal or contractual obligation, then business continuity impact, then cost-effectiveness is the easiest to defend. What comes out of this is the **risk assessment table**.',
        },

        { type: 'h2', id: 'step6-risk-treatment', text: 'Step 6: The Four Treatment Options and Selecting Annex A Controls' },
        {
          type: 'p',
          text: 'For every risk that needs treatment, choose one of four options. You do not have to mitigate everything; what matters is that the reasoning behind accepting or sharing a risk is on record.',
        },
        {
          type: 'table',
          headers: ['Option', 'What it means', 'Example'],
          rows: [
            ['Modify (mitigate)', 'Add controls to reduce likelihood or impact', 'Quarterly access rights review plus multi-factor authentication'],
            ['Avoid', 'Stop the activity that creates the risk', 'Stop retaining personal data the business does not need'],
            ['Share (transfer)', 'Distribute the risk through contracts or insurance', 'Cyber insurance; explicit security requirements in supplier contracts'],
            ['Retain (accept)', 'Keep the risk because it falls within criteria', 'A score-2 availability risk accepted by the risk owner'],
          ],
        },
        { type: 'h3', id: 'soa-and-risk-treatment-plan', text: 'The Statement of Applicability and the Risk Treatment Plan' },
        {
          type: 'p',
          text: 'Once options are chosen, determine the necessary controls and compare them against the 93 Annex A controls to confirm nothing was overlooked. That comparison produces the **Statement of Applicability (SoA)**, recording applicable controls, the justification for including them, implementation status, and the reason for excluding any control. Marking a control as not applicable is fine; the reason just has to be consistent with the assessment results.',
        },
        {
          type: 'ol',
          items: [
            'Decide the treatment option (modify, avoid, share, retain) for each risk',
            'For risks you decided to modify, determine the specific controls needed',
            'Compare the determined controls against Annex A and check for overlooked areas',
            'Record applicable controls, justification, implementation status and exclusion reasons in the SoA',
            'Break the work down in the risk treatment plan: actions, owners, deadlines, resources',
            'Calculate residual risk and obtain risk owner approval for it and for the treatment plan',
          ],
        },
        { type: 'h3', id: 'residual-risk-approval', text: 'Residual Risk Approval and Review Frequency' },
        {
          type: 'p',
          text: 'Residual risk is what remains after controls are applied. Re-evaluate it, confirm it sits within the acceptance criteria, and record the risk owner approval. Going into operation without that approval on record is a common finding. Plan a review **at least once a year**, and re-assess on top of that whenever something changes: a new system, an office move, a serious incident, or a change of key supplier. For the overall effort involved, see [the cost of ISMS certification](/guide/isms-certification-cost).',
        },

        { type: 'h2', id: 'common-pitfalls', text: 'Common Failures and Practical Tips' },
        {
          type: 'ul',
          items: [
            '**Too many assets** — past a few hundred file-level rows, the annual review stops happening. Roll up to system, database or shared-folder level.',
            '**Vague criteria and drifting scores** — without worked examples for "Moderate impact", the same asset scores differently next year under a new reviewer. Always attach examples to the criteria document.',
            '**SoA and risk assessment table out of step** — a control marked applicable in the SoA that is not linked to any risk in the treatment plan. Keep the two cross-referenced.',
            '**Risk owners who are individual contributors** — an owner without approval authority makes residual risk approval a formality. Assign roles that can actually sign off.',
          ],
        },

        { type: 'h2', id: 'managing-with-tools', text: 'Managing the Register and the Matrix in a Tool' },
        {
          type: 'p',
          text: 'The outputs so far are four artefacts that all reference each other: the asset register, the risk assessment table, the SoA and the risk treatment plan. Spreadsheets are a fine starting point, but past roughly 100 assets you see register updates that never reach the SoA, forked versions from concurrent editing, and no change history to show who changed a score and when.',
        },
        {
          type: 'p',
          text: 'Linking the four as one dataset, with change history and approvals captured automatically, turns the annual review into a diff rather than a full re-inventory. Riscala AI for ISMS is built around that shape. If you first want to see how far along your own organisation is, start with the [ISMS readiness self-check](/research).',
        },
      ],
      faq: [
        {
          question: 'Should we use the asset-based or the event-based approach?',
          answer:
            'ISO/IEC 27001:2022 does not prescribe either, so any method the organisation can justify is acceptable. For organisations of up to 100 people, a combined approach works well: use the asset-based method for coverage, then add high-impact scenarios such as ransomware or a leak through a subcontractor. If you already maintain an asset register, start asset-based; if you are cloud-heavy with few owned assets, starting event-based gets you moving faster.',
        },
        {
          question: 'How many information assets should we list?',
          answer:
            'The standard sets no number. As a practical guide, an IT company of up to 100 people rolling up to business system, database and shared-folder level typically lands at 50 to 150 entries. Past a few hundred, the annual review becomes unrealistic, so consider raising the granularity and merging rows. If you are down at around ten, check whether supplier, paper-based and people-related assets are missing.',
        },
        {
          question: 'How often should the risk assessment be performed?',
          answer:
            'Clause 8.2 requires assessments at planned intervals and when significant changes are proposed or occur. In practice, most organisations build an annual review into the yearly plan and then re-assess the affected area whenever a new system goes live, the scope or premises change, a serious incident occurs, or a key supplier changes.',
        },
        {
          question: 'Is a spreadsheet good enough for risk assessment?',
          answer:
            'The standard does not prescribe a format, so a spreadsheet can meet the requirements, and many organisations start there for the first certification. Once you pass about 100 assets, though, register updates tend not to propagate to the Statement of Applicability, concurrent editing forks the version, and there is no history of who changed a score and when. Rising maintenance effort is the usual signal to consider moving to a tool.',
        },
        {
          question: 'Will accepting a risk cause problems at audit?',
          answer:
            'No. Clause 6.1.3 recognises options beyond mitigation, and retention is a legitimate treatment. Three things matter: the risk falls within the acceptance criteria you defined in advance, the reasoning is recorded, and the risk owner approval is retained. What draws findings is a risk marked "no action" with no criteria behind it.',
        },
      ],
      keywords: [
        'ISMS risk assessment',
        'ISO 27001 risk assessment steps',
        'information asset inventory',
        'risk evaluation criteria',
        'risk treatment',
        'statement of applicability',
        'risk acceptance criteria',
        'risk assessment table example',
        'asset register',
      ],
    },
    zh: {
      title: 'ISMS风险评估怎么做｜从信息资产梳理到适用性声明的6个步骤',
      metaTitle: 'ISMS风险评估怎么做｜6个步骤与表格示例',
      description:
        'ISO/IEC 27001风险评估的实操步骤：制定风险准则、梳理信息资产、风险分析、风险评价、风险处置与适用性声明。附评价准则矩阵表、资产台账字段示例与常见误区。',
      lead:
        'ISMS的风险评估，并不是把信息资产列出来、给看着危险的打个勾。ISO/IEC 27001:2022 在第6.1.2条要求建立风险评估过程，在第6.1.3条要求建立风险处置过程并编制适用性声明（SoA），并在第8.2条和8.3条要求按策划的时间间隔实施、保留形成文件的信息。实操顺序是6个步骤：①制定风险准则 ②梳理信息资产 ③识别威胁与脆弱性 ④风险分析 ⑤风险评价 ⑥风险处置。只要守住先定准则、再列资产这个顺序，之后就是逐项填写的工作。',
      blocks: [
        { type: 'h2', id: 'risk-assessment-in-iso27001', text: '风险评估在ISO/IEC 27001中的位置' },
        {
          type: 'p',
          text: '在ISMS中，风险评估是连接"保护什么"与"采用哪些控制措施"的唯一桥梁。若先定控制措施再补理由，审核时一定会被追问依据。标准的要求可归纳为以下四点。',
        },
        {
          type: 'ul',
          items: [
            '**第6.1.2条（信息安全风险评估）** — 制定风险接受准则与实施评估的准则，确保过程能产生一致、有效且可比较的结果。包含风险识别、分析、评价，以及识别风险责任人。',
            '**第6.1.3条（信息安全风险处置）** — 选择处置方案，确定必要的控制措施，与附录A比对确认无遗漏，并编制**适用性声明（SoA）**。风险处置计划与剩余风险还需取得风险责任人的批准。',
            '**第8.2 / 8.3条** — 按策划的时间间隔，以及在发生重大变更时实施评估，执行风险处置计划，并将结果保留为形成文件的信息。',
            '**附录A** — 93项控制措施的参考清单。它不是"从中挑选"的菜单，而是用于比对已确定控制措施有无遗漏的对照表。',
          ],
        },
        {
          type: 'p',
          text: '整体流程可参见[ISO27001认证取得的推进方式](/guide/iso27001-certification-process)。通常应在确定适用范围之后立即启动，并早于控制措施的实施。',
        },

        { type: 'h2', id: 'step1-risk-criteria', text: '步骤1：先定义风险准则（接受准则与评价准则）' },
        {
          type: 'p',
          text: '最先确定的不是资产而是准则。没有准则就开始列资产，不同负责人的评分会出现偏差，最后只能全部重打分。需要确定四项：可能性尺度、影响程度尺度、评分方法、风险接受准则。中小规模组织采用三级即可运行。',
        },
        {
          type: 'table',
          headers: ['可能性 / 影响程度', '轻微（1）', '中等（2）', '重大（3）'],
          rows: [
            ['高（3）／每年数次以上', '3：中风险', '6：高风险', '9：最高风险'],
            ['中（2）／数年一次', '2：低风险', '4：中风险', '6：高风险'],
            ['低（1）／极少发生', '1：低风险', '2：低风险', '3：中风险'],
          ],
        },
        {
          type: 'p',
          text: '影响程度以保密性、完整性、可用性（CIA）受损时的业务影响来衡量。在准则文件中写入判断示例，例如"客户数据外泄属重大（3）"，可避免评分漂移。**风险接受准则**同样要用数值明确写出，例如"评分3分及以下予以接受，4分及以上需考虑处置"。',
        },
        {
          type: 'callout',
          title: '接受准则由管理层决定',
          text: '组织愿意承担多大风险属于经营判断，而非技术判断。若接受准则的数值仅由信息系统负责人确定，往往在剩余风险批准阶段被推翻，评分只能重做。在步骤1阶段取得管理层共识，是最短路径。',
        },

        { type: 'h2', id: 'step2-asset-inventory', text: '步骤2：梳理信息资产并建立资产台账' },
        {
          type: 'p',
          text: '接下来梳理适用范围内的信息资产。对象不仅是数据本身，还包括承载与处理数据的系统，以及相关的人员和场所。台账至少应包含以下字段。',
        },
        {
          type: 'table',
          headers: ['字段', '内容', '填写示例'],
          rows: [
            ['资产名称', '可识别的名称，避免含糊的统称', '客户管理SaaS（CRM）的客户主数据'],
            ['资产分类', '信息／软件／物理／服务／人员等类别', '信息'],
            ['资产责任人', '承担管理责任的岗位，宜用岗位名而非姓名', '销售部长'],
            ['存放位置与介质', '所在位置；云端需写明服务商与区域', '云端（SaaS服务商A・境内区域）'],
            ['重要度（C・I・A）', '保密性、完整性、可用性各按三级评定', 'C:3 / I:3 / A:2'],
            ['密级标识', '机密／内部／公开等分类标签', '机密'],
          ],
        },
        {
          type: 'p',
          text: '颗粒度是成败的分水岭。按单个文件统计会达到数千条而无法维护；笼统写成"内部系统"又太粗，无法落到控制措施。建议以**业务系统、数据库、共享文件夹**为单位，100人以内规模通常在50～150条之间。资产台账也是认证所需文件之一，与[ISMS所需文件清单](/guide/isms-required-documents)一并整理可避免重复劳动。',
        },

        { type: 'h2', id: 'step3-threats-and-vulnerabilities', text: '步骤3：识别威胁与脆弱性（基于资产与基于事件）' },
        {
          type: 'p',
          text: '风险识别大体有两种方法，ISO/IEC 27001:2022 并未强制其一。实操中并用更为现实。',
        },
        {
          type: 'ul',
          items: [
            '**基于资产的方法** — 针对每项资产，将"威胁（可能发生什么）"与"脆弱性（为何可能发生）"组合导出风险。例如：客户主数据 × 权限配置错误 × 离职人员账号未清理 → 非授权查阅。覆盖性强，但条目数容易膨胀。',
            '**基于事件（情景）的方法** — 从"勒索软件导致核心系统停摆"等可能发生的事件出发描述风险。条目较少、便于向管理层说明，但需另备核对清单以确认有无遗漏。',
            '**并用的做法** — 以资产台账保证覆盖性，再将影响较大的事件（供应链、内部违规、灾害、云服务商故障）作为独立情景补充。',
          ],
        },
        {
          type: 'p',
          text: '此环节须为每项风险指定**风险责任人**。标准要求的是风险的责任人而非资产的所有者，即决定处置方针、批准剩余风险的角色，实务中通常为部门负责人层级。',
        },

        { type: 'h2', id: 'step4-5-analysis-and-evaluation', text: '步骤4・5：通过风险分析与评价确定优先级' },
        {
          type: 'p',
          text: '使用步骤1确定的尺度，为每项风险赋予可能性与影响程度并计算评分。分析时原则上应评价现有控制措施发挥作用的状态（现状风险）。若按完全没有对策来评，所有条目都会变成最高风险，无法排出优先级。',
        },
        {
          type: 'p',
          text: '评价环节将评分与接受准则比对，筛选出需要处置的风险。评分相同时，按是否存在法规与合同要求、影响是否波及业务连续性、处置成本是否相称的顺序判断，最便于说明。至此形成的记录即**风险评估表**。',
        },

        { type: 'h2', id: 'step6-risk-treatment', text: '步骤6：风险处置的四种方案与附录A控制措施的选择' },
        {
          type: 'p',
          text: '对判定需要处置的风险，从以下四种方案中选择方针。不必全部填成"降低"，重要的是选择接受或转移的理由有据可查。',
        },
        {
          type: 'table',
          headers: ['处置方针', '内容', '示例'],
          rows: [
            ['降低（缓解）', '增加控制措施以降低可能性或影响程度', '每季度开展访问权限盘点，并引入多因素认证'],
            ['规避', '停止产生风险的活动本身', '停止保存业务上不必要的个人数据'],
            ['转移（分担）', '通过合同或保险与他方分担', '投保网络安全保险；在外包合同中明确安全要求'],
            ['接受（保留）', '判定在准则范围内而保持现状', '评分2的可用性下降，由风险责任人批准接受'],
          ],
        },
        { type: 'h3', id: 'soa-and-risk-treatment-plan', text: '适用性声明（SoA）与风险处置计划' },
        {
          type: 'p',
          text: '方针确定后，确定必要的控制措施，并与附录A的93项控制措施比对确认有无遗漏。在此基础上编制**适用性声明（SoA）**，记载采用的控制措施及其依据、实施状况，以及不采用的控制措施的排除理由。写明"不适用"本身没有问题，关键是理由与风险评估结果保持一致。',
        },
        {
          type: 'ol',
          items: [
            '逐项确定风险处置方针（降低、规避、转移、接受）',
            '对选择降低的风险，具体确定所需的控制措施',
            '将已确定的控制措施与附录A比对，确认有无遗漏领域',
            '在适用性声明（SoA）中记载采用的控制措施、依据、实施状况与排除理由',
            '在风险处置计划中落实实施事项、责任人、期限与所需资源',
            '测算剩余风险，连同风险处置计划一并取得风险责任人的批准',
          ],
        },
        { type: 'h3', id: 'residual-risk-approval', text: '剩余风险的批准与复审频次' },
        {
          type: 'p',
          text: '实施控制措施后仍然存在的风险即剩余风险。需重新评价，确认处于接受准则范围内，并留存风险责任人的批准记录。未取得批准即进入运行，是较常见的问题点。复审应按**每年至少一次**有计划地进行，此外在引入新系统、办公场所迁移、发生重大事件、更换外包方时随时重新评价。整体投入可参见[ISMS认证取得的费用](/guide/isms-certification-cost)。',
        },

        { type: 'h2', id: 'common-pitfalls', text: '常见误区与实操要点' },
        {
          type: 'ul',
          items: [
            '**资产列得过多** — 按文件为单位超过数百条后，每年一次的复审就转不动了。以系统、数据库、共享文件夹为单位归并更为现实。',
            '**准则含糊导致评分漂移** — 未写明"影响程度：中"的判断示例，次年换人后同一资产的评分就会改变。准则文件务必附上判断示例。',
            '**SoA与风险评估表不一致** — SoA中标为"采用"的控制措施，在处置计划中却未与任何风险关联。二者应可相互检索。',
            '**风险责任人由经办人担任** — 让没有批准权限的经办人担任责任人，剩余风险的批准会流于形式。应指派具有决策权的岗位。',
          ],
        },

        { type: 'h2', id: 'managing-with-tools', text: '用工具管理台账与矩阵' },
        {
          type: 'p',
          text: '以上产出共有四项：资产台账、风险评估表、SoA、风险处置计划，且相互引用。用Excel也能起步，但资产超过100条后，就会出现台账更新未反映到SoA、多人同时编辑导致版本分叉、缺少变更履历而无法说明何时由谁改了评分等问题。',
        },
        {
          type: 'p',
          text: '将四者作为同一份数据联通，并自动留存变更履历与批准记录，每年一次的复审就能从全面盘点变为核对差异。Riscala AI for ISMS 正是按这种形态提供管理机制。若想先确认本公司推进到了哪一步，可从[ISMS现状自查](/research)开始梳理。',
        },
      ],
      faq: [
        {
          question: '基于资产与基于事件，应该选择哪种方法？',
          answer:
            'ISO/IEC 27001:2022 未指定其一，只要组织能够说明其合理性即可。100人以内规模通常采用并用型较易操作：以基于资产的方法保证覆盖性，再补充勒索软件、经由外包方泄露等影响较大的事件情景。已有资产台账的组织宜从基于资产入手；以云服务为主、自有资产较少的组织从基于事件入手启动更快。',
        },
        {
          question: '信息资产大概要列多少条？',
          answer:
            '标准未规定条数。实操参考：100人以内规模的IT企业，以业务系统、数据库、共享文件夹为单位归并后，通常为50～150条。超过数百条后每年一次的复审现实中难以运转，条目膨胀时应提高颗粒度进行合并。反之若仅有10条左右，请确认是否遗漏了外包方、纸质介质与人员相关的资产。',
        },
        {
          question: '风险评估应以怎样的频次实施？',
          answer:
            '第8.2条要求按预先确定的时间间隔实施，以及在提出或发生重大变更时实施。实务上一般将每年一次的定期复审纳入年度计划，此外在引入新系统、适用范围或办公场所变更、发生重大事件、更换主要外包方时，针对相应范围随时重新评价。',
        },
        {
          question: '用Excel管理风险评估可以吗？',
          answer:
            '标准未指定形式，用Excel也能满足要求，首次取证时多数组织从Excel起步。但资产超过100条后，容易出现资产台账的更新未反映到适用性声明、同时编辑导致版本分叉、无法追溯何时由谁修改了评分等运行问题。维持阶段工时开始上升的时点，就是考虑迁移到工具的参考信号。',
        },
        {
          question: '风险处置选择"接受"会在审核中出问题吗？',
          answer:
            '不会。第6.1.3条认可降低以外的方案，接受也是正当的处置方针。关键有三点：处于预先确定的风险接受准则范围内、判断依据有记录、留存风险责任人的批准。会被指出问题的，是未制定准则却只写着"不处置"的状态。',
        },
      ],
      keywords: [
        'ISMS 风险评估',
        'ISO27001 风险评估 步骤',
        '信息资产 梳理',
        '风险评价 准则',
        '风险处置',
        '适用性声明',
        '风险接受准则',
        '风险评估表 示例',
        '资产台账',
      ],
    },
  },
};
