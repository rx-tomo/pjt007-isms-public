/**
 * ISO/IEC 27001:2022 附属書A の93管理策。
 * 管理策名のみを保持する一覧データで、規格本文の逐語引用は含まない。
 */

export type AnnexATheme = 'organizational' | 'people' | 'physical' | 'technological';

export interface AnnexAControl {
  /** 管理策番号（'5.1' 〜 '8.34'） */
  id: string;
  theme: AnnexATheme;
  /** 日本語の管理策名 */
  ja: string;
  /** 英語の管理策名 */
  en: string;
  /** 簡体字中国語の管理策名 */
  zh: string;
  /** 2022年版で新設された11管理策のみ true */
  isNew?: true;
}

export const ANNEX_A_THEMES: readonly AnnexATheme[] = [
  'organizational',
  'people',
  'physical',
  'technological',
];

export const ANNEX_A_CONTROLS: readonly AnnexAControl[] = [
  { id: '5.1', theme: 'organizational', ja: '情報セキュリティのための方針群', en: 'Policies for information security', zh: '信息安全方针' },
  { id: '5.2', theme: 'organizational', ja: '情報セキュリティの役割及び責任', en: 'Information security roles and responsibilities', zh: '信息安全角色与职责' },
  { id: '5.3', theme: 'organizational', ja: '職務の分離', en: 'Segregation of duties', zh: '职责分离' },
  { id: '5.4', theme: 'organizational', ja: '経営陣の責任', en: 'Management responsibilities', zh: '管理职责' },
  { id: '5.5', theme: 'organizational', ja: '関係当局との連絡', en: 'Contact with authorities', zh: '与主管部门的联系' },
  { id: '5.6', theme: 'organizational', ja: '専門組織との連絡', en: 'Contact with special interest groups', zh: '与特定相关方的联系' },
  { id: '5.7', theme: 'organizational', ja: '脅威インテリジェンス', en: 'Threat intelligence', zh: '威胁情报', isNew: true },
  { id: '5.8', theme: 'organizational', ja: 'プロジェクトマネジメントにおける情報セキュリティ', en: 'Information security in project management', zh: '项目管理中的信息安全' },
  { id: '5.9', theme: 'organizational', ja: '情報及びその他の関連資産の目録', en: 'Inventory of information and other associated assets', zh: '信息及其他相关资产的清单' },
  { id: '5.10', theme: 'organizational', ja: '情報及びその他の関連資産の利用の許容範囲', en: 'Acceptable use of information and other associated assets', zh: '信息及其他相关资产的可接受使用' },
  { id: '5.11', theme: 'organizational', ja: '資産の返却', en: 'Return of assets', zh: '资产归还' },
  { id: '5.12', theme: 'organizational', ja: '情報の分類', en: 'Classification of information', zh: '信息分类' },
  { id: '5.13', theme: 'organizational', ja: '情報のラベル付け', en: 'Labelling of information', zh: '信息标记' },
  { id: '5.14', theme: 'organizational', ja: '情報転送', en: 'Information transfer', zh: '信息传输' },
  { id: '5.15', theme: 'organizational', ja: 'アクセス制御', en: 'Access control', zh: '访问控制' },
  { id: '5.16', theme: 'organizational', ja: '識別情報の管理', en: 'Identity management', zh: '身份管理' },
  { id: '5.17', theme: 'organizational', ja: '認証情報', en: 'Authentication information', zh: '鉴别信息' },
  { id: '5.18', theme: 'organizational', ja: 'アクセス権', en: 'Access rights', zh: '访问权限' },
  { id: '5.19', theme: 'organizational', ja: '供給者関係における情報セキュリティ', en: 'Information security in supplier relationships', zh: '供应商关系中的信息安全' },
  { id: '5.20', theme: 'organizational', ja: '供給者との合意における情報セキュリティの取扱い', en: 'Addressing information security within supplier agreements', zh: '供应商协议中的信息安全' },
  { id: '5.21', theme: 'organizational', ja: 'ICTサプライチェーンにおける情報セキュリティの管理', en: 'Managing information security in the ICT supply chain', zh: 'ICT供应链中的信息安全管理' },
  { id: '5.22', theme: 'organizational', ja: '供給者のサービス提供の監視，レビュー及び変更管理', en: 'Monitoring, review and change management of supplier services', zh: '供应商服务的监视、评审与变更管理' },
  { id: '5.23', theme: 'organizational', ja: 'クラウドサービスの利用における情報セキュリティ', en: 'Information security for use of cloud services', zh: '使用云服务的信息安全', isNew: true },
  { id: '5.24', theme: 'organizational', ja: '情報セキュリティインシデント管理の計画及び準備', en: 'Information security incident management planning and preparation', zh: '信息安全事件管理的策划与准备' },
  { id: '5.25', theme: 'organizational', ja: '情報セキュリティ事象の評価及び決定', en: 'Assessment and decision on information security events', zh: '信息安全事态的评估与决策' },
  { id: '5.26', theme: 'organizational', ja: '情報セキュリティインシデントへの対応', en: 'Response to information security incidents', zh: '信息安全事件的响应' },
  { id: '5.27', theme: 'organizational', ja: '情報セキュリティインシデントからの学習', en: 'Learning from information security incidents', zh: '从信息安全事件中学习' },
  { id: '5.28', theme: 'organizational', ja: '証拠の収集', en: 'Collection of evidence', zh: '证据收集' },
  { id: '5.29', theme: 'organizational', ja: '事業の中断・阻害時の情報セキュリティ', en: 'Information security during disruption', zh: '中断期间的信息安全' },
  { id: '5.30', theme: 'organizational', ja: '事業継続のためのICTの備え', en: 'ICT readiness for business continuity', zh: '业务连续性的ICT就绪', isNew: true },
  { id: '5.31', theme: 'organizational', ja: '法令，規制及び契約上の要求事項', en: 'Legal, statutory, regulatory and contractual requirements', zh: '法律、法规、监管与合同要求' },
  { id: '5.32', theme: 'organizational', ja: '知的財産権', en: 'Intellectual property rights', zh: '知识产权' },
  { id: '5.33', theme: 'organizational', ja: '記録の保護', en: 'Protection of records', zh: '记录保护' },
  { id: '5.34', theme: 'organizational', ja: 'プライバシー及びPIIの保護', en: 'Privacy and protection of PII', zh: '隐私与个人可识别信息的保护' },
  { id: '5.35', theme: 'organizational', ja: '情報セキュリティの独立したレビュー', en: 'Independent review of information security', zh: '信息安全的独立评审' },
  { id: '5.36', theme: 'organizational', ja: '情報セキュリティのための方針群，規則及び標準の順守', en: 'Compliance with policies, rules and standards for information security', zh: '符合信息安全方针、规则与标准' },
  { id: '5.37', theme: 'organizational', ja: '操作手順書', en: 'Documented operating procedures', zh: '形成文件的操作规程' },

  { id: '6.1', theme: 'people', ja: '選考', en: 'Screening', zh: '审查' },
  { id: '6.2', theme: 'people', ja: '雇用条件', en: 'Terms and conditions of employment', zh: '雇佣条款与条件' },
  { id: '6.3', theme: 'people', ja: '情報セキュリティの意識向上，教育及び訓練', en: 'Information security awareness, education and training', zh: '信息安全意识、教育与培训' },
  { id: '6.4', theme: 'people', ja: '懲戒手続', en: 'Disciplinary process', zh: '违规处理过程' },
  { id: '6.5', theme: 'people', ja: '雇用の終了又は変更後の責任', en: 'Responsibilities after termination or change of employment', zh: '雇佣终止或变更后的职责' },
  { id: '6.6', theme: 'people', ja: '秘密保持契約又は守秘義務契約', en: 'Confidentiality or non-disclosure agreements', zh: '保密协议' },
  { id: '6.7', theme: 'people', ja: 'リモートワーク', en: 'Remote working', zh: '远程办公' },
  { id: '6.8', theme: 'people', ja: '情報セキュリティ事象の報告', en: 'Information security event reporting', zh: '信息安全事态报告' },

  { id: '7.1', theme: 'physical', ja: '物理的セキュリティ境界', en: 'Physical security perimeters', zh: '物理安全边界' },
  { id: '7.2', theme: 'physical', ja: '物理的入退', en: 'Physical entry', zh: '物理入口' },
  { id: '7.3', theme: 'physical', ja: 'オフィス，部屋及び施設のセキュリティ', en: 'Securing offices, rooms and facilities', zh: '办公室、房间与设施的安全' },
  { id: '7.4', theme: 'physical', ja: '物理的セキュリティの監視', en: 'Physical security monitoring', zh: '物理安全监视', isNew: true },
  { id: '7.5', theme: 'physical', ja: '物理的及び環境的脅威からの保護', en: 'Protecting against physical and environmental threats', zh: '物理与环境威胁的防护' },
  { id: '7.6', theme: 'physical', ja: 'セキュリティを保つべき領域での作業', en: 'Working in secure areas', zh: '在安全区域内工作' },
  { id: '7.7', theme: 'physical', ja: 'クリアデスク・クリアスクリーン', en: 'Clear desk and clear screen', zh: '清理桌面与清屏' },
  { id: '7.8', theme: 'physical', ja: '装置の設置及び保護', en: 'Equipment siting and protection', zh: '设备安置与保护' },
  { id: '7.9', theme: 'physical', ja: '構外にある資産のセキュリティ', en: 'Security of assets off-premises', zh: '场所外资产的安全' },
  { id: '7.10', theme: 'physical', ja: '記憶媒体', en: 'Storage media', zh: '存储介质' },
  { id: '7.11', theme: 'physical', ja: 'サポートユーティリティ', en: 'Supporting utilities', zh: '支持性设施' },
  { id: '7.12', theme: 'physical', ja: 'ケーブル配線のセキュリティ', en: 'Cabling security', zh: '布缆安全' },
  { id: '7.13', theme: 'physical', ja: '装置の保守', en: 'Equipment maintenance', zh: '设备维护' },
  { id: '7.14', theme: 'physical', ja: '装置の安全な処分又は再利用', en: 'Secure disposal or re-use of equipment', zh: '设备的安全处置或再利用' },

  { id: '8.1', theme: 'technological', ja: '利用者エンドポイント機器', en: 'User endpoint devices', zh: '用户终端设备' },
  { id: '8.2', theme: 'technological', ja: '特権的アクセス権', en: 'Privileged access rights', zh: '特权访问权限' },
  { id: '8.3', theme: 'technological', ja: '情報へのアクセス制限', en: 'Information access restriction', zh: '信息访问限制' },
  { id: '8.4', theme: 'technological', ja: 'ソースコードへのアクセス', en: 'Access to source code', zh: '源代码访问' },
  { id: '8.5', theme: 'technological', ja: 'セキュリティを保った認証', en: 'Secure authentication', zh: '安全鉴别' },
  { id: '8.6', theme: 'technological', ja: '容量・能力の管理', en: 'Capacity management', zh: '容量管理' },
  { id: '8.7', theme: 'technological', ja: 'マルウェアに対する保護', en: 'Protection against malware', zh: '恶意软件防护' },
  { id: '8.8', theme: 'technological', ja: '技術的脆弱性の管理', en: 'Management of technical vulnerabilities', zh: '技术脆弱性管理' },
  { id: '8.9', theme: 'technological', ja: '構成管理', en: 'Configuration management', zh: '配置管理', isNew: true },
  { id: '8.10', theme: 'technological', ja: '情報の削除', en: 'Information deletion', zh: '信息删除', isNew: true },
  { id: '8.11', theme: 'technological', ja: 'データマスキング', en: 'Data masking', zh: '数据脱敏', isNew: true },
  { id: '8.12', theme: 'technological', ja: 'データ漏えい防止', en: 'Data leakage prevention', zh: '数据泄露防护', isNew: true },
  { id: '8.13', theme: 'technological', ja: '情報のバックアップ', en: 'Information backup', zh: '信息备份' },
  { id: '8.14', theme: 'technological', ja: '情報処理施設の冗長性', en: 'Redundancy of information processing facilities', zh: '信息处理设施的冗余' },
  { id: '8.15', theme: 'technological', ja: 'ログ取得', en: 'Logging', zh: '日志记录' },
  { id: '8.16', theme: 'technological', ja: '監視活動', en: 'Monitoring activities', zh: '监视活动', isNew: true },
  { id: '8.17', theme: 'technological', ja: 'クロックの同期', en: 'Clock synchronization', zh: '时钟同步' },
  { id: '8.18', theme: 'technological', ja: '特権的なユーティリティプログラムの使用', en: 'Use of privileged utility programs', zh: '特权实用程序的使用' },
  { id: '8.19', theme: 'technological', ja: '運用システムに関わるソフトウェアの導入', en: 'Installation of software on operational systems', zh: '运行系统上的软件安装' },
  { id: '8.20', theme: 'technological', ja: 'ネットワークのセキュリティ', en: 'Networks security', zh: '网络安全' },
  { id: '8.21', theme: 'technological', ja: 'ネットワークサービスのセキュリティ', en: 'Security of network services', zh: '网络服务安全' },
  { id: '8.22', theme: 'technological', ja: 'ネットワークの分離', en: 'Segregation of networks', zh: '网络隔离' },
  { id: '8.23', theme: 'technological', ja: 'ウェブフィルタリング', en: 'Web filtering', zh: '网络过滤', isNew: true },
  { id: '8.24', theme: 'technological', ja: '暗号の利用', en: 'Use of cryptography', zh: '密码技术的使用' },
  { id: '8.25', theme: 'technological', ja: 'セキュリティに配慮した開発のライフサイクル', en: 'Secure development life cycle', zh: '安全开发生命周期' },
  { id: '8.26', theme: 'technological', ja: 'アプリケーションのセキュリティ要求事項', en: 'Application security requirements', zh: '应用安全要求' },
  { id: '8.27', theme: 'technological', ja: 'セキュリティに配慮したシステムアーキテクチャ及びシステム構築の原則', en: 'Secure system architecture and engineering principles', zh: '安全系统架构与工程原则' },
  { id: '8.28', theme: 'technological', ja: 'セキュリティに配慮したコーディング', en: 'Secure coding', zh: '安全编码', isNew: true },
  { id: '8.29', theme: 'technological', ja: '開発及び受入れにおけるセキュリティ試験', en: 'Security testing in development and acceptance', zh: '开发与验收中的安全测试' },
  { id: '8.30', theme: 'technological', ja: '外部委託による開発', en: 'Outsourced development', zh: '外包开发' },
  { id: '8.31', theme: 'technological', ja: '開発環境，試験環境及び本番環境の分離', en: 'Separation of development, test and production environments', zh: '开发、测试与生产环境的分离' },
  { id: '8.32', theme: 'technological', ja: '変更管理', en: 'Change management', zh: '变更管理' },
  { id: '8.33', theme: 'technological', ja: '試験情報', en: 'Test information', zh: '测试信息' },
  { id: '8.34', theme: 'technological', ja: '監査試験中の情報システムの保護', en: 'Protection of information systems during audit testing', zh: '审计测试期间的信息系统保护' },
];
