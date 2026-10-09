import type { GuideArticle } from '../types';

export const ismsCertificationCost: GuideArticle = {
  "slug": "isms-certification-cost",
  "publishedAt": "2026-09-10",
  "updatedAt": "2026-10-09",
  "related": [
    "iso27001-certification-process",
    "isms-required-documents",
    "isms-vs-privacy-mark"
  ],
  "content": {
    "ja": {
      "title": "ISMS（ISO27001）認証の費用｜9項目の内訳と見積もりの作り方",
      "metaTitle": "ISMS認証の費用｜内訳・内部工数・見積もり",
      "description": "ISMS認証の費用を、審査・コンサル・内部工数など9項目に整理。初年度と維持費を分け、見積もりの範囲、税込・税別、重複計上を確認する方法と、架空の工数計算例を紹介します。",
      "lead": "ISMS認証の総費用は、審査機関への支払いだけでなく、準備・運用を担う社内の時間や追加対策も含めて考えます。全国共通の価格として提示できる根拠がないため、このページでは相場の断定をせず、9項目の内訳と自社の見積もりを作る手順を示します。初年度と認証後の維持費を分け、外部支出と内部工数を区別してください。",
      "blocks": [
        {
          "type": "h2",
          "id": "cost-overview",
          "text": "初年度と維持費を分ける"
        },
        {
          "type": "p",
          "text": "初回の準備・審査と、認証後の審査・運用を別々に計画します。[認証取得の進め方](/guide/iso27001-certification-process)を確認し、各審査の時期・請求条件・更新までの計画を契約する審査機関に確認してください。"
        },
        {
          "type": "h2",
          "id": "cost-breakdown",
          "text": "費用の内訳｜9つの構成要素"
        },
        {
          "type": "table",
          "headers": [
            "費用項目",
            "計上する場面",
            "見積もりで確認する範囲"
          ],
          "rows": [
            [
              "初回登録審査",
              "初年度",
              "第一・第二段階、旅費、追加審査の扱い"
            ],
            [
              "登録料・管理料",
              "登録時・維持時",
              "審査料との重複、毎年の請求有無"
            ],
            [
              "サーベイランス審査",
              "維持時",
              "対象年度、旅費、変更に伴う追加費用"
            ],
            [
              "更新審査",
              "更新時",
              "更新時期、審査料と登録料の区分"
            ],
            [
              "外部コンサルティング",
              "準備・運用時",
              "文書作成、レビュー、監査支援の含有範囲"
            ],
            [
              "ツール・SaaS",
              "準備・運用時",
              "利用人数、導入費、出力・解約時の条件"
            ],
            [
              "内部工数（人件費）",
              "準備・運用時",
              "文書、リスク、教育、監査、レビューの作業時間"
            ],
            [
              "教育・研修",
              "準備・運用時",
              "受講料と受講者の内部工数を分ける"
            ],
            [
              "追加対策",
              "必要時",
              "機器・設定・施設対策と維持費"
            ]
          ]
        },
        {
          "type": "p",
          "text": "金額は審査機関や支援先への個別見積もりで埋めます。外部支出の小計と内部工数の評価額は別に示し、合計の含有範囲を明記してください。"
        },
        {
          "type": "h2",
          "id": "cost-by-size",
          "text": "人数だけで総額を決めない"
        },
        {
          "type": "p",
          "text": "[JQAの公式FAQ](https://www.jqa.jp/service_list/management/service/iso27001/faq.html)では、対象組織の人員数・事業所数などに応じて審査料金を算出すると説明しています。人数だけの表から総額を決めず、対象事業・拠点・要員数をそろえて見積もりを取ります。コンサル、ツール、内部工数は審査料金と別に評価します。"
        },
        {
          "type": "h2",
          "id": "internal-effort",
          "text": "内部工数を金額に換算する｜架空の計算例"
        },
        {
          "type": "p",
          "text": "内部工数の評価額は「作業別の時間 × 自社で設定する時間単価」で計算します。以下は計算方法を示す架空の例で、相場・標準工数ではありません。[必要な文書と記録](/guide/isms-required-documents)をもとに自社の作業を洗い出してください。"
        },
        {
          "type": "callout",
          "text": "仮に準備作業120時間、社内評価単価3,000円／時間なら、内部工数の評価額は36万円です。これは審査料・コンサル費・ツール費を含みません。維持時の工数は別に見積もり、外注と内製が重複する作業を二重計上しないようにします。"
        },
        {
          "type": "h2",
          "id": "quote-checklist",
          "text": "見積もりの比較で確認すること"
        },
        {
          "type": "ul",
          "items": [
            "初回・維持・更新の対象期間をそろえ、更新費用が比較期間に入るか確認する",
            "税込・税別、旅費、追加審査、登録料などの含有範囲をそろえる",
            "外部支出と内部工数を分け、同じ作業の二重計上を避ける",
            "適用範囲・拠点・要員数と、外部支援の成果物・担当範囲をそろえる"
          ]
        },
        {
          "type": "h2",
          "id": "cost-reduction",
          "text": "費用を抑える前に、必要な範囲を整理する"
        },
        {
          "type": "p",
          "text": "取引先要件と自社の活動から適用範囲を検討し、既存の文書・運用記録を活用します。外部支援は依頼する作業と社内で担う作業を明確にしてください。ツールは一元管理に使えるかを評価し、費用削減効果を前提にしないでください。公開デモでは架空データで操作を確認できます。"
        },
        {
          "type": "h2",
          "id": "sources",
          "text": "出典と情報の範囲"
        },
        {
          "type": "p",
          "text": "料金の算出条件は[JQAの公式FAQ](https://www.jqa.jp/service_list/management/service/iso27001/faq.html)、見積もりに必要な項目は[JQAの見積依頼案内](https://www.jqa.jp/service_list/management/estimate/index.html)で確認しました（2026年10月9日）。これらはJQAの案内であり、全国の相場を示す資料ではありません。9項目の分類と計算例は本記事の予算整理用の編集例です。"
        }
      ],
      "faq": [
        {
          "question": "最低いくらで取得できますか？",
          "answer": "全国共通の最低価格はこのページでは提示できません。対象事業・拠点・要員数を整理して審査機関へ見積もりを依頼し、内部工数や追加対策も別に評価してください。"
        },
        {
          "question": "内部工数は見積もりに含めますか？",
          "answer": "社外への支払額と社内工数を分けて示します。工数を金額に換算する場合は時間と自社の評価単価を明記し、合計に含めた費用を説明してください。"
        },
        {
          "question": "維持費も必要ですか？",
          "answer": "認証後の審査、文書・リスク・教育・監査等の運用にも支出と内部工数が生じます。更新時の費用も含め、契約する審査機関の計画で確認してください。"
        }
      ],
      "keywords": [
        "ISMS",
        "ISO27001",
        "certification cost",
        "internal effort"
      ]
    },
    "en": {
      "title": "ISO 27001 Certification Costs: Nine Items and How to Build an Estimate",
      "metaTitle": "ISO 27001 Costs: Breakdown and Internal Effort",
      "description": "Build an ISMS budget with nine cost items. Separate external fees from internal effort, compare quote scope, and use a fictional labour calculation.",
      "lead": "Budget for ISO 27001 with both external payments and the time spent preparing and running the ISMS. This guide does not assert a universal market price: it provides nine cost items and a method for making your own estimate. Separate first-year costs from maintenance and cash payments from internal effort.",
      "blocks": [
        {
          "type": "h2",
          "id": "cost-overview",
          "text": "Separate year one and maintenance"
        },
        {
          "type": "p",
          "text": "Plan preparation and initial audits separately from subsequent audits and operations. Read the [certification process](/guide/iso27001-certification-process) and confirm audit dates, payment terms and the renewal plan with your certification body."
        },
        {
          "type": "h2",
          "id": "cost-breakdown",
          "text": "Cost breakdown: nine components"
        },
        {
          "type": "table",
          "headers": [
            "Item",
            "When to budget",
            "What to confirm"
          ],
          "rows": [
            [
              "Initial certification audit",
              "Year one",
              "Stages 1 and 2, travel and additional audits"
            ],
            [
              "Registration and administration",
              "Registration and maintenance",
              "Overlap with audit fees and recurring charges"
            ],
            [
              "Surveillance audit",
              "Maintenance",
              "Covered years, travel and change-related charges"
            ],
            [
              "Recertification audit",
              "Renewal",
              "Timing and separation from registration fees"
            ],
            [
              "External consulting",
              "Preparation and operations",
              "Document drafting, reviews and audit support"
            ],
            [
              "Tools and SaaS",
              "Preparation and operations",
              "Seats, setup, export and exit terms"
            ],
            [
              "Internal effort",
              "Preparation and operations",
              "Time for documents, risks, training, audits and review"
            ],
            [
              "Training",
              "Preparation and operations",
              "Separate course fees and attendee time"
            ],
            [
              "Additional controls",
              "As needed",
              "Equipment, configuration, facilities and upkeep"
            ]
          ]
        },
        {
          "type": "p",
          "text": "Fill amounts from individual quotes. Show external payments and the value of internal time separately, and specify what the total includes."
        },
        {
          "type": "h2",
          "id": "cost-by-size",
          "text": "Headcount alone does not determine the total"
        },
        {
          "type": "p",
          "text": "[JQA’s official FAQ](https://www.jqa.jp/service_list/management/service/iso27001/faq.html) says its audit charges depend on personnel, sites and other organizational details. Provide consistent activities, sites and headcount when obtaining quotes. Assess consulting, tools and internal effort separately from audit charges."
        },
        {
          "type": "h2",
          "id": "internal-effort",
          "text": "Internal effort: a fictional calculation"
        },
        {
          "type": "p",
          "text": "Value internal effort as hours per activity multiplied by your own hourly cost. The example below is fictional, not a market rate or standard workload. Use the [documents and records guide](/guide/isms-required-documents) to identify your work."
        },
        {
          "type": "callout",
          "text": "Assume 120 preparation hours at an internal rate of JPY 3,000 per hour: the internal effort is valued at JPY 360,000. Audit, consulting and tool fees are excluded. Estimate maintenance separately and avoid counting outsourced work twice."
        },
        {
          "type": "h2",
          "id": "quote-checklist",
          "text": "Checks when comparing quotes"
        },
        {
          "type": "ul",
          "items": [
            "Align periods for initial, maintenance and renewal costs, including whether renewal falls within the comparison period",
            "Align tax treatment, travel, additional audits and registration charges",
            "Separate external payments and internal effort; avoid duplicate work costs",
            "Use consistent scope, sites, personnel and consulting deliverables"
          ]
        },
        {
          "type": "h2",
          "id": "cost-reduction",
          "text": "Clarify scope before reducing costs"
        },
        {
          "type": "p",
          "text": "Define scope from customer requirements and your actual activities, reuse existing records, and clarify outsourced versus internal work. Evaluate whether tools support your workflows rather than assuming savings. Try the public demo only with fictional data."
        },
        {
          "type": "h2",
          "id": "sources",
          "text": "Sources and limits"
        },
        {
          "type": "p",
          "text": "Checked on 9 October 2026: [JQA’s official FAQ](https://www.jqa.jp/service_list/management/service/iso27001/faq.html) for pricing factors and [JQA’s estimate guidance](https://www.jqa.jp/service_list/management/estimate/index.html) for quote inputs. These describe JQA, not a nationwide price survey. The nine-item classification and calculation are editorial budgeting examples."
        }
      ],
      "faq": [
        {
          "question": "What is the minimum price?",
          "answer": "This page cannot give a universal minimum. Obtain a quote with your activities, sites and personnel, and assess internal effort and additional controls separately."
        },
        {
          "question": "Should internal effort be included?",
          "answer": "Show external payments and internal time separately. State the hours and your chosen rate when valuing time, and explain what the total includes."
        },
        {
          "question": "Are there ongoing costs?",
          "answer": "Subsequent audits and ISMS operations require external spending and internal time. Confirm a plan including renewal costs with your certification body."
        }
      ],
      "keywords": [
        "ISMS",
        "ISO27001",
        "certification cost",
        "internal effort"
      ]
    },
    "zh": {
      "title": "ISMS（ISO27001）认证费用｜九项明细与估算方法",
      "metaTitle": "ISMS认证费用｜明细、内部工时与估算",
      "description": "将ISMS费用分为九项，区分首年与维护、外部支出与内部工时。通过虚构计算例说明预算范围，并检查报价的税费与重复计算。",
      "lead": "ISMS预算应包括审核等外部支出，以及准备和运行体系的内部时间。本文不将无依据的金额作为统一市场价格，而是介绍九项明细与自有预算的估算方法。请区分首年与维护、外部付款与内部工时。",
      "blocks": [
        {
          "type": "h2",
          "id": "cost-overview",
          "text": "区分首年与维护费用"
        },
        {
          "type": "p",
          "text": "将准备和初次审核与后续审核、日常运行分别计划。参阅[认证流程](/guide/iso27001-certification-process)，向签约认证机构确认审核日期、付款条件与更新计划。"
        },
        {
          "type": "h2",
          "id": "cost-breakdown",
          "text": "费用明细｜九项构成"
        },
        {
          "type": "table",
          "headers": [
            "费用项目",
            "计入时期",
            "报价检查范围"
          ],
          "rows": [
            [
              "初次认证审核",
              "首年",
              "第一与第二阶段、差旅、追加审核"
            ],
            [
              "注册与管理",
              "注册与维护",
              "与审核费的重叠及年度收费"
            ],
            [
              "监督审核",
              "维护",
              "覆盖年度、差旅、变更追加费用"
            ],
            [
              "再认证审核",
              "更新",
              "时期与注册费的区分"
            ],
            [
              "外部咨询",
              "准备与运行",
              "文件起草、评审与审核支持范围"
            ],
            [
              "工具与SaaS",
              "准备与运行",
              "用户数、导入、导出与退出条件"
            ],
            [
              "内部工时",
              "准备与运行",
              "文件、风险、培训、审核与评审时间"
            ],
            [
              "教育与培训",
              "准备与运行",
              "区分课程费和参加者工时"
            ],
            [
              "追加措施",
              "按需",
              "设备、配置、设施与维护"
            ]
          ]
        },
        {
          "type": "p",
          "text": "金额请填写单独取得的报价。分别列示外部付款和内部工时评价额，并明确合计包含的范围。"
        },
        {
          "type": "h2",
          "id": "cost-by-size",
          "text": "人数不能单独决定总额"
        },
        {
          "type": "p",
          "text": "[JQA官方FAQ](https://www.jqa.jp/service_list/management/service/iso27001/faq.html)说明，其审核费用依据组织人员数、场所数等计算。取得报价时统一活动、场所与人员条件。咨询、工具和内部工时应与审核费用分开评估。"
        },
        {
          "type": "h2",
          "id": "internal-effort",
          "text": "内部工时换算｜虚构计算例"
        },
        {
          "type": "p",
          "text": "内部工时评价额为各项作业时间乘以自设小时成本。以下仅为虚构计算例，不是市场价格或标准工时。请根据[所需文件与记录](/guide/isms-required-documents)整理自身作业。"
        },
        {
          "type": "callout",
          "text": "假设准备作业120小时，内部评价单价为3,000日元／小时，则内部工时评价额为36万日元。此金额不含审核、咨询或工具费用。维护工时应另行估算，避免将外包与内部同一作业重复计入。"
        },
        {
          "type": "h2",
          "id": "quote-checklist",
          "text": "比较报价时的检查事项"
        },
        {
          "type": "ul",
          "items": [
            "统一初次、维护与更新的比较期间，确认期间是否包含更新",
            "统一含税／未税、差旅、追加审核与注册费范围",
            "区分外部付款与内部工时，避免重复计入",
            "统一适用范围、场所、人员与咨询交付范围"
          ]
        },
        {
          "type": "h2",
          "id": "cost-reduction",
          "text": "降低费用之前明确范围"
        },
        {
          "type": "p",
          "text": "根据客户要求与自身活动确定范围，利用已有文件和记录，明确外包与内部作业。评价工具是否适合流程，不预设节省效果。公开演示仅使用虚构数据体验。"
        },
        {
          "type": "h2",
          "id": "sources",
          "text": "来源与信息范围"
        },
        {
          "type": "p",
          "text": "2026年10月9日确认：[JQA官方FAQ](https://www.jqa.jp/service_list/management/service/iso27001/faq.html)提供计价因素，[JQA报价指南](https://www.jqa.jp/service_list/management/estimate/index.html)提供报价资料。这些为JQA说明，不是全国行情调查。九项分类与计算例是本文的预算整理示例。"
        }
      ],
      "faq": [
        {
          "question": "最低多少钱可以取得认证？",
          "answer": "本文无法给出统一最低价格。请整理活动、场所与人员条件取得认证机构报价，并另行评估内部工时与追加措施。"
        },
        {
          "question": "是否包含内部工时？",
          "answer": "分别列示外部付款与内部时间。换算金额时注明小时数、自设单价与合计包含的项目。"
        },
        {
          "question": "需要维护费用吗？",
          "answer": "后续审核与ISMS运行会产生外部支出及内部工时。请向认证机构确认包含更新费用的计划。"
        }
      ],
      "keywords": [
        "ISMS",
        "ISO27001",
        "certification cost",
        "internal effort"
      ]
    }
  }
};
