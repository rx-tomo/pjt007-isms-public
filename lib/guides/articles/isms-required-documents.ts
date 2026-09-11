import type { GuideArticle } from '../types';

export const ismsRequiredDocuments: GuideArticle = {
  slug: 'isms-required-documents',
  publishedAt: '2026-09-10',
  updatedAt: '2026-09-10',
  related: ['iso27001-certification-process', 'isms-risk-assessment', 'iso27001-annex-a-controls'],
  content: {
    ja: {
      title: 'ISMS（ISO27001）で必要な文書一覧｜規格が要求する文書化された情報と記録を整理',
      metaTitle: 'ISMS文書一覧｜ISO27001で必要な文書と記録',
      description:
        'ISO/IEC 27001で必要な文書を、規格本文が明示的に要求するものと、附属書Aの管理策に合わせて実務上整備することが多いものの2層に分けて一覧化。文書と記録の違い、文書体系、版数管理の要件までまとめて解説します。',
      lead:
        'ISMSの文書は「規格本文が箇条ではっきり要求しているもの」と「附属書Aの管理策を運用するために実務上ほぼ必要になるもの」の2層に分けると整理しやすくなります。前者は数えられる範囲に収まり、後者は組織の規模やリスクによって増減します。この2層を混ぜたまま作り始めると、更新が追いつかない文書の山になりがちです。本記事では両者を一覧表で分け、文書と記録の違い、文書体系の作り方、文書管理の要件までを整理します。',
      blocks: [
        {
          type: 'h2',
          id: 'two-layers',
          text: 'ISMS文書は「必須」と「実務上ほぼ必要」の2層で考える',
        },
        {
          type: 'p',
          text: 'ISO/IEC 27001:2022の本文（箇条4〜10）には、「文書化した情報として利用可能な状態にすること」「保持すること」と明記された箇所があります。これが第1層、つまり**規格が明示的に要求する文書化した情報**であり、存在しないこと自体が審査で指摘され得ます。',
        },
        {
          type: 'p',
          text: '第2層は、附属書Aの管理策を「どう運用しているか」を説明するために整備することが多い規程・手順です。規格は規程の名前までは指定しませんが、アクセス権の付与・見直しの手順が決まっていなければ、管理策が運用されていることを説明しにくくなります。取得までの流れ全体は[ISO27001認証取得の進め方](/guide/iso27001-certification-process)にまとめています。',
        },
        {
          type: 'callout',
          title: '文書の数より、運用との一致',
          text: '文書の点数を増やすことが目的ではありません。規程に書いた頻度でレビューが行われ、記録が残っているか、という一致の方が重視されます。維持できない運用は最初から書かない、という判断も現実的です。',
        },
        {
          type: 'h2',
          id: 'mandatory-documents',
          text: '規格本文が明示的に要求する文書化した情報の一覧',
        },
        {
          type: 'p',
          text: '箇条番号とあわせて整理すると、自社に何が欠けているかを機械的に確認できます。名称は規格の用語であり、実際のファイル名は自社の呼び方で構いません。複数を1ファイルにまとめても分割しても、要求を満たしていれば形式は問われないのが一般的な考え方です。',
        },
        {
          type: 'table',
          headers: ['箇条', '文書化した情報', '位置づけと記載の要点'],
          rows: [
            ['4.3', 'ISMSの適用範囲', '対象の組織・拠点・業務・システムと、範囲外との境界を示す'],
            ['5.2', '情報セキュリティ方針', 'トップマネジメントが承認し、目的の枠組みと継続的改善の意思を示す'],
            ['6.1.2 / 6.1.3', 'リスクアセスメントおよびリスク対応のプロセス', '基準（受容基準・実施基準）、手順、責任者を定義する'],
            ['6.1.3 d)', '適用宣言書（SoA）', '各管理策の適用可否、適用・除外理由、実施状況を一覧化する'],
            ['6.2', '情報セキュリティ目的', '測定可能な形で設定し、達成計画（誰が・いつ・何を）を伴う'],
            ['7.2', '力量の証拠', '担当者の力量を裏づける教育・資格・経験の記録'],
            ['7.5', '規格が要求する文書／組織が必要と判断した文書', '文書管理の対象そのものの定義'],
            ['8.1', '運用の計画および管理に関する文書化した情報', '計画どおり実施されたと確信するために必要な範囲で保持'],
            ['8.2', 'リスクアセスメントの結果', '実施した時点のリスク一覧・評価結果'],
            ['8.3', 'リスク対応の結果', '選択した対応と実施状況'],
            ['9.1', '監視、測定、分析および評価の結果', '何を・いつ・誰が測ったかを含む'],
            ['9.2', '内部監査プログラムおよび監査結果', '計画（頻度・範囲・基準）と実施報告の双方'],
            ['9.3', 'マネジメントレビューの結果', '各インプットへの対応と決定・指示事項'],
            ['10.1 / 10.2', '不適合の性質と処置、是正処置の結果', '発生事象、応急処置、原因分析、再発防止と有効性確認'],
          ],
        },
        {
          type: 'p',
          text: 'リスクアセスメントのプロセスと結果は、この表の中でも作成に時間がかかりやすい部分です。進め方は[ISMSのリスクアセスメント](/guide/isms-risk-assessment)で個別に扱っています。',
        },
        {
          type: 'h2',
          id: 'annex-a-procedures',
          text: '附属書Aの管理策に合わせて整備することが多い規程・手順',
        },
        {
          type: 'p',
          text: '次の表は、100名規模までのIT企業でよく整備される単位です。すべてを別ファイルにする必要はなく、「情報セキュリティ管理規程」1本に章立てでまとめる組織も少なくありません。判断の軸は、**改訂の頻度が違うものを同じファイルに入れない**ことです。',
        },
        {
          type: 'table',
          headers: ['領域', '想定される規程・手順', '対になる主な記録'],
          rows: [
            ['資産管理', '情報資産管理規程、利用の許容範囲', '情報資産台帳、持出し申請'],
            ['情報分類', '情報分類・取扱い基準、ラベリング手順', '分類の見直し記録'],
            ['アクセス制御', 'アクセス制御規程、特権ID管理手順', 'アクセス権付与・削除申請、アクセス権レビュー記録'],
            ['供給者管理', '外部委託・供給者管理規程', '委託先評価シート、秘密保持契約、年次見直し'],
            ['インシデント管理', 'インシデント対応手順、報告連絡体制', 'インシデント記録、対応報告'],
            ['事業継続', '事業継続・ICT可用性に関する手順', '訓練記録、復旧テスト結果'],
            ['変更管理', '変更管理手順、リリース承認基準', '変更申請・承認記録'],
            ['セキュアな開発', '開発標準、コードレビュー基準、環境分離方針', 'レビュー記録、テスト結果、脆弱性対応'],
            ['ログ管理', 'ログ取得・保護・保存期間の基準', '監視結果、異常検知の対応記録'],
            ['物理・人的', '入退管理手順、雇用時および終了時の手続', '入退室記録、誓約書、返却チェック'],
          ],
        },
        {
          type: 'h2',
          id: 'document-vs-record',
          text: '「文書」と「記録」の違い',
        },
        {
          type: 'p',
          text: '旧版では「文書」と「記録」を分けて要求していましたが、現行版はどちらも**文書化した情報**という1つの用語で扱います。ただし実務上は、性質の違いを意識した方が管理しやすくなります。',
        },
        {
          type: 'ul',
          items: [
            '文書（方針・規程・手順・様式）は「これから何をするか」を定め、版数管理と承認が中心になる',
            '記録（申請、議事録、レビュー結果、監査報告）は「実際に何が起きたか」の証跡で、書き換えを防ぐ保護が中心になる',
            '規格の表現では、前者はおおむね「維持する」、後者は「保持する」に対応する',
            '空白の様式は文書、記入済みの様式は記録、と考えると台帳が整理しやすい',
          ],
        },
        {
          type: 'h2',
          id: 'document-hierarchy',
          text: '文書体系の階層と、増やしすぎないコツ',
        },
        {
          type: 'p',
          text: '一般的には、方針 → 規程 → 手順 → 様式／記録の4階層で組み立てます。上位ほど改訂頻度が低く承認者の職位が高い、下位ほど頻繁に変わる、という関係です。これが崩れると、細かい運用変更のたびにトップマネジメントの承認が必要になり、更新が止まります。',
        },
        {
          type: 'ul',
          items: [
            '方針は1本に絞る。下位方針を作るのは、対象読者や承認者が本当に分かれるときだけにする',
            '規程は「誰が・何を・どの頻度で」までにとどめ、画面操作は下位の手順書に逃がす',
            'ツール名や画面名が変わるたびに改訂が要る内容は、規程本文に埋め込まない',
            '既存の社内規程（就業規則など）と重複する内容は、書き写さずに参照する',
            '運用できる見込みのない頻度（例: 毎月の全件棚卸し）を規程に書かない',
          ],
        },
        {
          type: 'h2',
          id: 'document-control',
          text: '文書管理そのものに求められること（7.5.2 / 7.5.3）',
        },
        {
          type: 'p',
          text: '文書の管理方法自体も要求事項です。7.5.2は作成・更新時に、識別（表題・日付・作成者・番号など）、形式と媒体、レビューと承認が適切であることを求めます。7.5.3は、必要なときに必要な場所で利用でき、かつ十分に保護されている状態を求めます。',
        },
        {
          type: 'table',
          headers: ['観点', '確認されやすい点', '運用の例'],
          rows: [
            ['識別', '表題・文書番号・適用日が分かるか', 'ヘッダーに文書番号と発効日を固定表示'],
            ['版数', '最新版がどれか一意に分かるか', '改訂履歴に版数・日付・改訂理由・承認者を残す'],
            ['承認', '権限のある者が承認しているか', '承認者の役割を文書管理規程で定義しておく'],
            ['配布・アクセス', '必要な人が読めるか、権限外に漏れないか', '共有権限の設定と閲覧範囲の定期確認'],
            ['保護', '意図しない変更・削除を防げるか', '正本の編集権限を限定し閲覧用は読み取り専用にする'],
            ['廃止', '旧版が誤って使われないか', '旧版は廃止表示のうえ別領域へ退避する'],
          ],
        },
        {
          type: 'h2',
          id: 'templates-and-audit',
          text: 'テンプレート利用の注意と、審査で見られやすい記録',
        },
        {
          type: 'p',
          text: 'テンプレートは出発点としては有効ですが、そのままでは自社の実態と合わない箇所が残ります。存在しない役職名や実施していない会議体が残ったままだと、記録との食い違いとして指摘されやすくなります。一般論として、導入直後に**書かれている頻度と役割名を実態に合わせて全文見直す**工程を挟むと、後戻りが減ります。',
        },
        {
          type: 'p',
          text: '審査では文書そのものより「その文書どおりに動いた証跡」が確認されます。特に次の記録は、期間の抜けや承認欄の空白が見つかりやすい部分です。',
        },
        {
          type: 'ul',
          items: [
            '教育・力量の記録（実施日、対象者、内容、理解度の確認）',
            'アクセス権のレビュー記録（対象システム、実施者、是正した内容）',
            '内部監査の計画と報告（監査員の独立性が分かる記載を含む）',
            'マネジメントレビューの議事録（インプット項目への対応と決定事項）',
            'インシデント記録（軽微な事象を含む。ゼロ件が続くと検知の仕組みを問われやすい）',
            '供給者の評価・見直し記録',
          ],
        },
        {
          type: 'callout',
          title: '文書量と工数はつながっている',
          text: '文書を増やすほど、レビュー・承認・改訂の工数が毎年かかります。初期構築と維持のコスト感は[ISO27001の費用](/guide/isms-certification-cost)で整理しています。',
        },
        {
          type: 'h2',
          id: 'operating-with-tools',
          text: '版数管理と承認フローをツール側で回すという選択',
        },
        {
          type: 'p',
          text: '文書一覧そのものはWordやスプレッドシートでも作れます。負荷が増えるのは、版数・承認・レビュー期限・記録との紐づけを人手で追い続ける部分です。文書、リスク、管理策、適用宣言書が別ファイルに散っていると、1つの改訂の波及を目視で追うことになります。',
        },
        {
          type: 'p',
          text: 'この作業をツール側に寄せると、承認履歴と版数が自動的に残り、レビュー期限の抜けも検知しやすくなります。まず自社にどの文書が足りていないかを確かめたい場合は、[ISMS現在地セルフチェック](/research)から始めるとよいでしょう。',
        },
      ],
      faq: [
        {
          question: 'ISMSの文書は最低いくつ必要ですか。',
          answer:
            '一律の正解はありません。規格本文が明示的に要求する文書化した情報は限られた数ですが、それを何ファイルに分けるかは組織の自由です。100名規模のIT企業では、方針1本と規程数本、手順・様式が十数点という構成になることが多いですが、事業内容や外部委託の範囲によって変わります。',
        },
        {
          question: 'Wordやスプレッドシートで文書管理をしても問題ありませんか。',
          answer:
            '媒体や形式は規格で指定されていないため、一般にファイル形式そのものが問題になることはありません。確認されるのは、最新版が一意に分かるか、承認の記録が残るか、権限外の変更や削除を防げるか、といった管理状態です。ファイル名に版数を付ける運用にする場合は、旧版の扱いを規程で決めておくと混乱を避けやすくなります。',
        },
        {
          question: 'ISMSマニュアルは必ず作る必要がありますか。',
          answer:
            '「マニュアル」という名称の1冊を作ることは、現行の規格では要求されていません。要求されているのは箇条ごとの文書化した情報であり、それらを1冊にまとめても、個別文書として持っても構いません。全体像を示す資料があると社内説明はしやすくなりますが、必須ではないという整理が一般的です。',
        },
        {
          question: '電子承認（ワークフローツールでの承認）は認められますか。',
          answer:
            '承認の方法は規格で限定されていないため、電子的な承認が一般に否定されることはありません。重要なのは、誰が・いつ・どの版を承認したかを後から確認できることと、承認権限が文書管理の取り決めと一致していることです。押印との併用を求めるかどうかは、自社の内部統制上の判断になります。',
        },
        {
          question: '文書はどのくらいの頻度で見直せばよいですか。',
          answer:
            '規格は具体的な頻度を定めていません。多くの組織は年1回の定期見直しに加え、組織変更、重大なインシデント、システムの大きな変更、法令や契約要求の変化があったときに随時見直す、という運用にしています。定めた頻度は必ず記録で裏づけられる範囲にとどめてください。',
        },
      ],
      keywords: [
        'ISMS 文書 一覧',
        'ISO27001 必要な文書',
        'ISMS 文書化された情報',
        '適用宣言書',
        '情報セキュリティ方針',
        'ISMS 規程 一覧',
        '文書管理',
        'ISMS 記録',
        'ISMS テンプレート',
      ],
    },
    en: {
      title:
        'Required Documents for an ISMS (ISO 27001): Documented Information and Records, Organized',
      metaTitle: 'ISO 27001 Required Documents and Records List',
      description:
        'ISO/IEC 27001 documents in two layers: the documented information the standard explicitly requires, and the policies teams build around Annex A controls.',
      lead:
        'ISMS documentation is easier to plan when you split it into two layers: what the standard explicitly requires clause by clause, and what most organizations end up writing in order to operate the Annex A controls. The first layer is a countable list. The second grows or shrinks with your size and risk profile. Mixing the two is how small teams end up with a pile of policies nobody updates. This guide separates them into tables, then covers the difference between documents and records, how to structure the hierarchy, and the version and approval requirements that apply to the documents themselves.',
      blocks: [
        {
          type: 'h2',
          id: 'two-layers',
          text: 'Think in two layers: required, and required in practice',
        },
        {
          type: 'p',
          text: 'Clauses 4 to 10 of ISO/IEC 27001:2022 state in specific places that information shall be available or retained as documented information. That is layer one: the **documented information the standard explicitly requires**. Its absence is something an audit can raise directly.',
        },
        {
          type: 'p',
          text: 'Layer two consists of the policies and procedures written to explain how Annex A controls actually run. The standard never names a specific policy, but if nothing defines how access rights are granted and reviewed, it is hard to show the control is operating. For the overall path to certification, see [how ISO 27001 certification works](/guide/iso27001-certification-process).',
        },
        {
          type: 'callout',
          title: 'Alignment beats volume',
          text: 'The goal is not a higher document count. What matters more is whether reviews happen at the frequency your policy claims, and whether records exist to show it. Choosing not to write down a practice you cannot sustain is a legitimate decision.',
        },
        {
          type: 'h2',
          id: 'mandatory-documents',
          text: 'Documented information the standard explicitly requires',
        },
        {
          type: 'p',
          text: 'Mapping items to clause numbers lets you check gaps mechanically. The names below are the wording of the standard; your own file names can differ. Combining several items into one file, or splitting one across several, is generally acceptable as long as the requirement is met.',
        },
        {
          type: 'table',
          headers: ['Clause', 'Documented information', 'Purpose and key points'],
          rows: [
            ['4.3', 'Scope of the ISMS', 'Organizations, sites, activities and systems in scope, and the boundary with what is out'],
            ['5.2', 'Information security policy', 'Approved by top management; frames objectives and commitment to improvement'],
            ['6.1.2 / 6.1.3', 'Risk assessment and risk treatment process', 'Criteria for acceptance and performance, method, and ownership'],
            ['6.1.3 d)', 'Statement of Applicability (SoA)', 'Applicability of each Annex A control, justification for inclusion or exclusion, implementation status'],
            ['6.2', 'Information security objectives', 'Measurable, with a plan naming who does what and by when'],
            ['7.2', 'Evidence of competence', 'Training, qualifications and experience supporting each role'],
            ['7.5', 'Documented information required by the standard and determined as necessary by the organization', 'Defines the set of documents under control'],
            ['8.1', 'Documented information on operational planning and control', 'Kept to the extent needed for confidence that processes ran as planned'],
            ['8.2', 'Results of risk assessments', 'The risk register and evaluation as of the assessment date'],
            ['8.3', 'Results of risk treatment', 'Selected treatments and their implementation status'],
            ['9.1', 'Results of monitoring, measurement, analysis and evaluation', 'What was measured, when, and by whom'],
            ['9.2', 'Internal audit programme and audit results', 'Both the plan (frequency, scope, criteria) and the reports'],
            ['9.3', 'Results of management review', 'How each input was handled, plus decisions and directions'],
            ['10.1 / 10.2', 'Nature of nonconformities, actions taken, and results of corrective action', 'Event, immediate action, root cause, prevention, and effectiveness check'],
          ],
        },
        {
          type: 'p',
          text: 'The risk assessment process and its results usually take the longest to produce. That step is covered separately in [ISMS risk assessment](/guide/isms-risk-assessment).',
        },
        {
          type: 'h2',
          id: 'annex-a-procedures',
          text: 'Policies and procedures commonly built around Annex A controls',
        },
        {
          type: 'p',
          text: 'The table below reflects what IT companies of up to roughly 100 people typically maintain. These need not be separate files; many organizations keep a single security management policy with chapters. The useful rule is to **avoid putting things with different revision rhythms in the same file**.',
        },
        {
          type: 'table',
          headers: ['Area', 'Typical policy or procedure', 'Matching records'],
          rows: [
            ['Asset management', 'Asset management policy, acceptable use', 'Asset inventory, removal requests'],
            ['Information classification', 'Classification and handling rules, labelling procedure', 'Reclassification records'],
            ['Access control', 'Access control policy, privileged account procedure', 'Grant and revoke requests, access review records'],
            ['Supplier management', 'Supplier and outsourcing policy', 'Supplier assessments, confidentiality agreements, annual reviews'],
            ['Incident management', 'Incident response procedure, escalation paths', 'Incident records, response reports, retrospectives'],
            ['Business continuity', 'Continuity and ICT readiness procedure', 'Exercise records, recovery test results'],
            ['Change management', 'Change procedure, release approval criteria', 'Change requests and approvals'],
            ['Secure development', 'Development standards, code review criteria, environment separation', 'Review records, test results, vulnerability handling'],
            ['Logging', 'Rules for log capture, protection and retention', 'Monitoring output, alert handling records'],
            ['Physical and people', 'Entry control, joiner and leaver procedures', 'Entry logs, agreements, asset return checklists'],
          ],
        },
        {
          type: 'h2',
          id: 'document-vs-record',
          text: 'Documents versus records',
        },
        {
          type: 'p',
          text: 'Older editions separated documents from records. ISO/IEC 27001:2022 uses the single term **documented information** for both. In day-to-day work, though, the distinction is still worth keeping.',
        },
        {
          type: 'ul',
          items: [
            'Documents (policies, procedures, forms) define what will be done; version control and approval dominate',
            'Records (requests, minutes, review results, audit reports) evidence what actually happened; protection against alteration dominates',
            'In the wording of the standard, the first roughly maps to maintain and the second to retain',
            'A blank form is a document; the same form once filled in is a record. That split keeps the register tidy',
          ],
        },
        {
          type: 'h2',
          id: 'document-hierarchy',
          text: 'The hierarchy, and how to keep it small',
        },
        {
          type: 'p',
          text: 'The common structure is policy, then procedures, then work instructions, then forms and records. Higher levels change rarely and are approved at a senior level; lower levels sit close to the work and change often. When that relationship breaks, every minor operational tweak needs executive approval and updates stall.',
        },
        {
          type: 'ul',
          items: [
            'Keep a single top-level policy. Add topic policies only when the audience or approver genuinely differs',
            'Keep procedures at the level of who does what and how often; push screen-level steps down to work instructions',
            'Do not embed tool-specific steps in a policy, since they change every time the tool does',
            'Reference existing internal rules such as employment regulations instead of copying their text',
            'Do not commit to a frequency you cannot sustain, such as a full monthly inventory of every asset',
          ],
        },
        {
          type: 'h2',
          id: 'document-control',
          text: 'Requirements on document control itself (7.5.2 and 7.5.3)',
        },
        {
          type: 'p',
          text: 'How you manage documents is itself a requirement. Clause 7.5.2 covers creation and update: identification such as title, date, author and reference number; format and media; and appropriate review and approval. Clause 7.5.3 covers control: availability where and when needed, and adequate protection.',
        },
        {
          type: 'table',
          headers: ['Aspect', 'What tends to be checked', 'Example practice'],
          rows: [
            ['Identification', 'Title, document number and effective date are visible', 'Fix the number and effective date in the header'],
            ['Version', 'The current version is unambiguous', 'Keep a revision table with version, date, reason and approver'],
            ['Approval', 'An authorized person approved it', 'Define approver roles in the document control policy'],
            ['Distribution and access', 'The right people can read it and others cannot', 'Set sharing permissions and re-check the audience periodically'],
            ['Protection', 'Unintended change or deletion is prevented', 'Restrict edit rights on the master; publish a read-only copy'],
            ['Obsolescence', 'Superseded versions cannot be used by mistake', 'Mark old versions as withdrawn and move them to a separate area'],
          ],
        },
        {
          type: 'h2',
          id: 'templates-and-audit',
          text: 'Using templates, and the records auditors look at closely',
        },
        {
          type: 'p',
          text: 'Templates are a reasonable starting point, but they arrive full of assumptions. Role titles you do not have, meetings you do not hold and technologies you do not use tend to survive into the submitted version, where they surface as contradictions against your records. As a general practice, **reviewing every stated frequency and role name against reality** immediately after adopting a template saves rework later.',
        },
        {
          type: 'p',
          text: 'Auditors also spend more time on evidence that a document was followed than on the document itself. The records below are where gaps in coverage or blank approval fields tend to show up.',
        },
        {
          type: 'ul',
          items: [
            'Training and competence records: date, participants, content, and confirmation of understanding',
            'Access review records: systems covered, reviewer, and what was corrected',
            'Internal audit plans and reports, including how auditor independence was assured',
            'Management review minutes: how each input was handled, and the decisions taken',
            'Incident records, including minor events; a long run of zero often invites questions about detection',
            'Supplier assessment and periodic review records',
          ],
        },
        {
          type: 'callout',
          title: 'Document volume is a running cost',
          text: 'Every additional document carries annual review, approval and revision effort. Build and maintenance costs are broken down in [the cost of ISO 27001](/guide/isms-certification-cost).',
        },
        {
          type: 'h2',
          id: 'operating-with-tools',
          text: 'Moving version control and approval into a tool',
        },
        {
          type: 'p',
          text: 'The list itself can live in a word processor or a spreadsheet. The load comes from tracking versions, approvals, review deadlines and the links between documents and records by hand. When documents, records, risks, controls and the Statement of Applicability sit in separate files, checking whether one revision propagated becomes a manual read-through.',
        },
        {
          type: 'p',
          text: 'Moving that bookkeeping into a tool leaves approval history and versions in place automatically and makes missed review dates easier to spot. If you first want to see which documents you are missing, the [ISMS readiness self-check](/research) is a reasonable place to start.',
        },
      ],
      faq: [
        {
          question: 'What is the minimum number of documents for an ISMS?',
          answer:
            'There is no fixed answer. The documented information the standard explicitly requires is a limited list, but how many files you split it into is up to you. IT companies of around 100 people often end up with one policy, a handful of procedures and a dozen or so forms, though scope and outsourcing change the picture.',
        },
        {
          question: 'Is it acceptable to manage documents in a word processor or spreadsheet?',
          answer:
            'The standard does not specify media or format, so the file type itself is generally not the issue. What is examined is whether the current version is unambiguous, whether approvals are recorded, and whether unauthorized change or deletion is prevented. If you put version numbers in file names, define how superseded files are handled.',
        },
        {
          question: 'Is an ISMS manual mandatory?',
          answer:
            'A single volume called a manual is not required by the current standard. What is required is the documented information named in each clause, and you may gather it into one book or keep it as separate documents. An overview document helps internal communication, but it is generally treated as optional.',
        },
        {
          question: 'Are electronic approvals accepted?',
          answer:
            'The standard does not restrict the method of approval, so electronic approval is generally not rejected. What matters is being able to show later who approved which version and when, and that the approver matches what your document control rules say. Whether to also require a seal or signature is an internal control decision.',
        },
        {
          question: 'How often should documents be reviewed?',
          answer:
            'No frequency is prescribed. Many organizations run an annual review and add ad hoc reviews after reorganizations, significant incidents, major system changes, or changes in legal and contractual requirements. Whatever you commit to should be a frequency your records can actually evidence.',
        },
      ],
      keywords: [
        'ISO 27001 required documents',
        'ISMS document list',
        'documented information',
        'Statement of Applicability',
        'information security policy',
        'document control',
        'ISMS records',
        'ISO 27001 templates',
      ],
    },
    zh: {
      title: 'ISMS（ISO27001）所需文件清单｜标准要求的文件化信息与记录梳理',
      metaTitle: 'ISMS文件清单｜ISO27001必备文件与记录',
      description:
        '把ISO/IEC 27001所需文件分为标准正文明确要求的文件化信息，以及围绕附录A控制措施在实务中通常需要编制的制度两层，并说明文件与记录的区别、文件体系与版本管理要求。',
      lead:
        '梳理ISMS文件时，把它分成两层会更清楚：一层是标准正文按条款明确要求的文件化信息，另一层是为运行附录A控制措施而在实务中几乎都会编制的制度与程序。前者数量有限且可以逐条核对，后者则随组织规模与风险状况增减。若把两层混在一起动手，很容易堆出一批无人更新的制度。本文用表格分别列出两层内容，并依次说明文件与记录的区别、文件体系的搭建方式，以及版本、审批等文件管理要求。',
      blocks: [
        {
          type: 'h2',
          id: 'two-layers',
          text: '用「必备」与「实务上几乎必需」两层来理解ISMS文件',
        },
        {
          type: 'p',
          text: 'ISO/IEC 27001:2022正文（第4至10章）在若干处明确写明须「保持为文件化信息」或「保留文件化信息」。这构成第一层，即**标准明确要求的文件化信息**。缺少这一层本身就可能在审核中被提出。',
        },
        {
          type: 'p',
          text: '第二层是为说明附录A控制措施如何运行而编制的制度与程序。标准并未规定必须叫什么名字，但如果访问权限的授予与复核完全没有约定，就很难说明控制措施确实在运行。整体取证流程可参见[ISO27001认证取得流程](/guide/iso27001-certification-process)。',
        },
        {
          type: 'callout',
          title: '文件数量不如与实际一致重要',
          text: '目标不是把文件数量做多。更受关注的是制度写明的复核频率是否真的执行、是否留有记录。对于无法维持的做法，一开始就不写进制度，也是现实的选择。',
        },
        {
          type: 'h2',
          id: 'mandatory-documents',
          text: '标准正文明确要求的文件化信息一览',
        },
        {
          type: 'p',
          text: '按条款号整理，可以机械地核对本组织缺什么。下表名称沿用标准用语，实际文件名可用自己的叫法。把多项合并为一个文件，或把一项拆成多个文件，通常都不影响符合性。',
        },
        {
          type: 'table',
          headers: ['条款', '文件化信息', '定位与要点'],
          rows: [
            ['4.3', 'ISMS适用范围', '写明纳入范围的组织、场所、业务与信息系统，以及与范围外的边界'],
            ['5.2', '信息安全方针', '由最高管理者批准，给出目标框架与持续改进的承诺'],
            ['6.1.2 / 6.1.3', '风险评估与风险处置过程', '规定准则（接受准则与实施准则）、方法与责任人'],
            ['6.1.3 d)', '适用性声明（SoA）', '逐条列出附录A控制措施的适用与否、纳入或排除理由及实施状况'],
            ['6.2', '信息安全目标', '以可测量的形式设定，并附达成计划（由谁、何时、做什么）'],
            ['7.2', '能力的证据', '支撑岗位能力的教育、资格与经验记录'],
            ['7.5', '标准要求的文件化信息与组织自行确定必需的文件化信息', '界定纳入文件管理的对象本身'],
            ['8.1', '运行策划与控制的文件化信息', '在足以确信过程按计划实施的范围内保留'],
            ['8.2', '风险评估结果', '实施当时的风险清单与评价结果'],
            ['8.3', '风险处置结果', '所选处置方式及其实施状况'],
            ['9.1', '监视、测量、分析与评价的结果', '包含测了什么、何时测、由谁测'],
            ['9.2', '内部审核方案与审核结果', '既包括计划（频次、范围、准则），也包括报告'],
            ['9.3', '管理评审结果', '对各项输入的处理，以及决定事项与指示事项'],
            ['10.1 / 10.2', '不符合的性质与所采取的措施、纠正措施的结果', '事件、应急处置、原因分析、防止再发生及有效性确认'],
          ],
        },
        {
          type: 'p',
          text: '其中风险评估的过程与结果通常最费时间，具体做法另见[ISMS风险评估](/guide/isms-risk-assessment)。',
        },
        {
          type: 'h2',
          id: 'annex-a-procedures',
          text: '围绕附录A控制措施常见的制度与程序',
        },
        {
          type: 'p',
          text: '下表是100人规模以内IT企业常见的编制单位。不必都做成独立文件，不少组织把它们作为章节收进一份「信息安全管理制度」。判断标准是：**修订频率不同的内容不要放进同一份文件**。',
        },
        {
          type: 'table',
          headers: ['领域', '常见制度或程序', '对应的主要记录'],
          rows: [
            ['资产管理', '信息资产管理制度、可接受使用范围', '信息资产台账、外带申请'],
            ['信息分类', '信息分类与处理基准、标识程序', '分类复核记录'],
            ['访问控制', '访问控制制度、特权账号管理程序', '权限授予与回收申请、权限复核记录'],
            ['供应方管理', '外包与供应方管理制度', '供应方评估表、保密协议、年度复核记录'],
            ['事件管理', '安全事件响应程序、报告与联络机制', '事件记录、处置报告、复盘'],
            ['业务连续性', '业务连续性与ICT可用性程序', '演练记录、恢复测试结果'],
            ['变更管理', '变更管理程序、发布审批基准', '变更申请与审批记录'],
            ['安全开发', '开发标准、代码评审基准、环境隔离方针', '评审记录、测试结果、漏洞处置记录'],
            ['日志管理', '日志采集、保护与保存期限基准', '监视结果、异常处置记录'],
            ['物理与人员', '出入管理程序、入职与离职手续', '出入记录、承诺书、归还清单'],
          ],
        },
        {
          type: 'h2',
          id: 'document-vs-record',
          text: '「文件」与「记录」的区别',
        },
        {
          type: 'p',
          text: '旧版把文件与记录分开要求，而ISO/IEC 27001:2022将两者统一称为**文件化信息**。不过在实务中，区分两者的性质仍然更便于管理。',
        },
        {
          type: 'ul',
          items: [
            '文件（方针、制度、程序、表单）规定「今后要做什么」，管理重点是版本与审批',
            '记录（申请、会议纪要、复核结果、审核报告）是「实际发生了什么」的证据，管理重点是防止事后改写',
            '按标准的措辞，前者大致对应「保持」，后者对应「保留」',
            '空白表单是文件，填写后的表单是记录，这样区分有助于台账清晰',
          ],
        },
        {
          type: 'h2',
          id: 'document-hierarchy',
          text: '文件体系的层级与控制数量的做法',
        },
        {
          type: 'p',
          text: '通常按方针 → 制度 → 程序 → 表单／记录四层搭建。层级越高修订越少、审批者职位越高；层级越低越贴近现场、变化越频繁。这一关系一旦被打乱，细小的运行调整也要最高管理者审批，更新就会停滞。',
        },
        {
          type: 'ul',
          items: [
            '方针只保留一份；仅当读者对象或审批者确实不同，才另设专题方针',
            '制度写到「谁、做什么、多久一次」为止，界面操作与工具专属步骤下沉到程序文件',
            '工具或界面名称一变就要改的内容，不要嵌进制度正文',
            '与既有内部规定（如员工手册、个人信息保护方针）重复的内容，引用而不是抄写',
            '不要把无法维持的频率（例如每月全量盘点）写进制度',
          ],
        },
        {
          type: 'h2',
          id: 'document-control',
          text: '对文件管理本身的要求（7.5.2 / 7.5.3）',
        },
        {
          type: 'p',
          text: '文件的管理方式本身也是要求。7.5.2针对创建与更新，要求标识（标题、日期、编制人、编号等）、格式与载体、以及适当的评审与批准。7.5.3要求文件在需要的时间与地点可获得，并得到充分保护。',
        },
        {
          type: 'table',
          headers: ['方面', '常见关注点', '运行示例'],
          rows: [
            ['标识', '能否看出标题、文件编号与生效日期', '在页眉固定显示文件编号与生效日期'],
            ['版本', '最新版本是否唯一可辨', '修订履历表记录版本、日期、修订理由与批准人'],
            ['批准', '是否由有权限者批准', '在文件管理制度中界定批准人角色'],
            ['分发与访问', '需要的人能否读到，是否会外泄', '设置共享权限并定期复核可见范围'],
            ['保护', '能否防止非预期的修改与删除', '正本限制编辑权限，阅览版设为只读'],
            ['作废', '旧版是否可能被误用', '旧版明确标注作废并移至单独区域'],
          ],
        },
        {
          type: 'h2',
          id: 'templates-and-audit',
          text: '使用模板的注意点与审核中常被查看的记录',
        },
        {
          type: 'p',
          text: '模板作为起点是有效的，但直接沿用会残留与本组织实际不符之处。并不存在的职位名称、并未召开的会议、并未采用的技术要素若原样留在文件中，就容易与记录相互矛盾而被提出。一般而言，引入模板后立即**逐句核对其中写明的频率与角色名称是否与实际一致**，可以减少返工。',
        },
        {
          type: 'p',
          text: '此外，审核更关注「是否按文件执行」的证据。以下记录尤其容易出现期间缺漏或审批栏空白。',
        },
        {
          type: 'ul',
          items: [
            '教育与能力记录（实施日期、对象、内容、理解程度确认）',
            '访问权限复核记录（涉及系统、实施人、纠正内容）',
            '内部审核的计划与报告（含可体现审核员独立性的记载）',
            '管理评审纪要（对各项输入的处理与决定事项）',
            '安全事件记录（包含轻微事件；长期为零往往会被追问检测机制）',
            '供应方评估与复核记录',
          ],
        },
        {
          type: 'callout',
          title: '文件数量与工作量相连',
          text: '文件越多，每年的评审、审批与修订工作量越大。初期建设与维持的费用可参见[ISO27001的费用](/guide/isms-certification-cost)。',
        },
        {
          type: 'h2',
          id: 'operating-with-tools',
          text: '把版本管理与审批流程交给工具的选择',
        },
        {
          type: 'p',
          text: '文件清单本身用文字处理软件或表格也能做。负担集中在靠人力持续追踪版本、审批、复核期限以及文件与记录之间的对应关系。当文件、记录、风险、控制措施与适用性声明分散在不同文件里时，一次修订是否波及其他部分只能靠人工逐一确认。',
        },
        {
          type: 'p',
          text: '把这部分工作交给工具，审批履历与版本会自动留存，复核期限的遗漏也更容易发现。若想先确认本组织缺少哪些文件，可以从[ISMS现状自查](/research)开始梳理容易缺失的项目。',
        },
      ],
      faq: [
        {
          question: 'ISMS最少需要多少份文件？',
          answer:
            '没有统一答案。标准正文明确要求的文件化信息数量有限，但拆成几份文件由组织自行决定。100人规模的IT企业常见的构成是一份方针、数份制度、十余份程序与表单，但会随业务内容与外包范围而变化。',
        },
        {
          question: '用Word或表格管理文件可以吗？',
          answer:
            '标准未规定载体与格式，因此文件格式本身通常不构成问题。被关注的是最新版本是否唯一可辨、是否留有审批记录、能否防止越权修改与删除。若采用在文件名中标注版本的做法，建议在制度中明确旧版的处理方式。',
        },
        {
          question: 'ISMS手册是必须编制的吗？',
          answer:
            '现行标准并未要求编制一本名为「手册」的文件。被要求的是各条款所对应的文件化信息，既可以汇编成一册，也可以分别保存。有一份说明整体框架的资料有助于内部沟通，但一般理解为并非必备。',
        },
        {
          question: '电子审批是否被认可？',
          answer:
            '标准未限定审批方式，因此电子审批一般不会被否定。关键在于事后能够确认谁在何时批准了哪一版本，且审批权限与文件管理的约定一致。是否同时要求盖章或签字，属于组织内部控制的判断。',
        },
        {
          question: '文件应当多久复核一次？',
          answer:
            '标准未规定具体频率。多数组织在每年定期复核之外，遇到组织变更、重大安全事件、系统重大变更或法律与合同要求变化时随时复核。所定的频率应控制在记录能够如实佐证的范围内。',
        },
      ],
      keywords: [
        'ISMS 文件 清单',
        'ISO27001 必备文件',
        '文件化信息',
        '适用性声明',
        '信息安全方针',
        '文件管理',
        'ISMS 记录',
        'ISO27001 模板',
      ],
    },
  },
};
