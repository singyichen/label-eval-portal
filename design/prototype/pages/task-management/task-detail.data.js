/*
 * Seed configuration profiles for the 17 task-list example tasks (T001-T017).
 *
 * Sources:
 *  - docs/product/task-configs/<sourceFile>   -> outputs[] (ADR-029 composition model)
 *  - docs/product/example-data/<sourceFile>   -> datasetRecords[]
 *
 * These are illustrative seeds for the prototype demo, not a system limit on
 * task categories, input types, output types, or dataset shape.
 */
(function (global) {
  'use strict';

  /* Shared reviewer guideline text for the single_label sentiment schema
     used by T001 and the T014-T017 review-flow demo seeds (issue #405).
     Each of T014-T017 appends its own review-model addendum below so the
     "提供給審核員" content actually matches that task's demo scenario
     instead of generic boilerplate -- see seedReviewFlowDemo() in
     annotation-workspace.data.js and PR #305 for the scenario source. */
  var REVIEWER_GUIDELINE_SENTIMENT_BOUNDARY_ZH =
    '審核判準（single_label 情感三分類）：\n' +
    '· positive：內容整體評價正面、無保留的稱讚或滿意陳述。\n' +
    '· neutral：中立敘述、有褒有貶或程度輕微的評論，找不到明確正負傾向時歸此類。\n' +
    '· negative：內容整體評價負面、抱怨或不滿意陳述。\n' +
    '與標記員標註不一致時，請依上述判準重新檢視文本語意後決定核可或修改，不可僅以標記員多數意見為準。\n';

  var profiles = {
    T001: {
      taskCategories: ['classification'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'single_label',
          config: {
            label_options: [
              { name: 'positive', color: '#10B981' },
              { name: 'neutral', color: '#F59E0B' },
              { name: 'negative', color: '#EC4899' }
            ]
          }
        }
      ],
      fieldRoleMap: { text: 'input', gold_label: 'output' },
      datasetFileName: 'single-label.json',
      datasetRecords: [
        {
          id: 'sent-001',
          text: '這次手術非常成功，主治醫師技術精湛，術後恢復也很順利，非常感謝醫療團隊的照顧。',
          gold_label: 'positive'
        },
        {
          id: 'sent-002',
          text: '候診時間太長了，等了三個小時才看到醫生，而且掛號系統一直當機，整個流程讓人很不滿意。',
          gold_label: 'negative'
        },
        {
          id: 'sent-003',
          text: '醫院的環境還算乾淨，停車場也夠大，不過門診量太多，每次都要等很久。',
          gold_label: 'neutral'
        },
        {
          id: 'sent-004',
          text: '護理師非常親切有耐心，每次換藥都會詳細解釋傷口狀況，讓我覺得很安心。',
          gold_label: 'positive'
        },
        {
          id: 'sent-005',
          text: '藥袋上的用藥說明印刷模糊，字太小根本看不清楚，對年長患者很不友善。',
          gold_label: 'negative'
        }
      ]
    },

    T002: {
      taskCategories: ['classification'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'multi_label',
          config: {
            label_options: [
              { name: 'happy', color: '#10B981' },
              { name: 'sad', color: '#0EA5E9' },
              { name: 'angry', color: '#EC4899' },
              { name: 'surprise', color: '#F59E0B' },
              { name: 'fear', color: '#8B5CF6' },
              { name: 'disgust', color: '#14B8A6' }
            ],
            max_selections: 3
          }
        }
      ],
      fieldRoleMap: { text: 'input', gold_labels: 'output' },
      datasetFileName: 'multi-label.json',
      datasetRecords: [
        {
          id: 'emo-001',
          text: '收到確診通知的那一刻，我整個人都僵住了，腦袋一片空白，然後就開始掉眼淚，覺得為什麼是我。',
          gold_labels: ['sad', 'fear', 'surprise']
        },
        {
          id: 'emo-002',
          text: '治療結束後回診，醫生說腫瘤指數恢復正常，我高興到在診間哭出來，覺得這半年的辛苦值得了！',
          gold_labels: ['happy', 'surprise']
        },
        {
          id: 'emo-003',
          text: '護理站的態度很差，我問個問題就被白眼，住院這幾天心情都很糟，覺得自己被當皮球踢。',
          gold_labels: ['angry', 'sad']
        },
        {
          id: 'emo-004',
          text: '看到隔壁床的阿嬤因為沒有家人來探病，一個人默默吃飯，心裡覺得很難過也很心疼。',
          gold_labels: ['sad']
        },
        {
          id: 'emo-005',
          text: '手術前一晚完全睡不著，一直想著萬一出什麼意外怎麼辦，護理師來安慰我才稍微放鬆一點。',
          gold_labels: ['fear']
        }
      ]
    },

    T003: {
      taskCategories: ['classification'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'multi_label',
          config: {
            label_options: [
              {
                id: 'emotion',
                name: '情緒',
                children: [
                  {
                    id: 'negative',
                    name: '負向',
                    children: [
                      { id: 'sad', name: '悲傷', color: '#6366F1' },
                      { id: 'anxious', name: '焦慮', color: '#10B981' }
                    ]
                  },
                  {
                    id: 'positive',
                    name: '正向',
                    children: [
                      { id: 'hopeful', name: '有盼望', color: '#F59E0B' }
                    ]
                  }
                ]
              },
              {
                id: 'care_context',
                name: '照護情境',
                children: [
                  {
                    id: 'clinical',
                    name: '臨床處置',
                    children: [
                      { id: 'urgent', name: '緊急', color: '#EC4899' }
                    ]
                  },
                  {
                    id: 'recovery',
                    name: '康復',
                    children: [
                      { id: 'follow_up', name: '後續追蹤', color: '#8B5CF6' }
                    ]
                  },
                  {
                    id: 'communication',
                    name: '溝通',
                    children: [
                      { id: 'needs_explanation', name: '需要說明', color: '#0EA5E9' }
                    ]
                  }
                ]
              }
            ],
            max_selections: 0,
            allow_bypass: true
          }
        }
      ],
      fieldRoleMap: { text: 'input', gold_labels: 'output' },
      datasetFileName: 'multi-label-hierarchical.json',
      datasetRecords: [
        {
          id: 'taxonomy-001',
          text: '病人表示確診後情緒低落，同時擔心治療副作用，今晚需要護理人員主動關懷。',
          gold_labels: [
            ['emotion', 'negative', 'sad'],
            ['care_context', 'clinical', 'urgent']
          ]
        },
        {
          id: 'taxonomy-002',
          text: '完成療程後，病人對恢復狀況感到安心，也開始期待回到日常生活。',
          gold_labels: [
            ['emotion', 'positive', 'hopeful'],
            ['care_context', 'recovery', 'follow_up']
          ]
        },
        {
          id: 'taxonomy-003',
          text: '病人因檢查結果延遲而焦慮，希望醫療團隊提供更清楚的說明。',
          gold_labels: [
            ['emotion', 'negative', 'anxious'],
            ['care_context', 'communication', 'needs_explanation']
          ]
        },
        {
          id: 'taxonomy-004',
          text: '家屬理解治療計畫後情緒較穩定，暫時沒有額外協助需求。',
          gold_labels: []
        },
        {
          id: 'taxonomy-005',
          text: '家屬情緒反應複雜暫難細分，先標記情緒大類；另對出院後照護安排有疑問，歸入溝通類別待補充說明。',
          gold_labels: [
            ['emotion'],
            ['care_context', 'communication']
          ]
        }
      ]
    },

    T004: {
      taskCategories: ['regression'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'single_dim',
          config: {
            dimension_name: 'readability',
            min: 1,
            max: 5,
            step: 1
          }
        }
      ],
      fieldRoleMap: { text: 'input', gold_score: 'output' },
      /* Materialized run context (spec 015: annotation list counts come
         from task-detail run publish events, not raw dataset size). Seed
         demo: dry run round R2 materialized a 10-item list; the 5 records
         below are the prototype's rendered subset. */
      materializedRuns: { dry_run: { round: 2, total: 10 } },
      datasetFileName: 'single-dim.json',
      datasetRecords: [
        {
          id: 'read-001',
          text: '慢性腎臟病的早期症狀通常不明顯，患者可能僅有輕微疲勞或食慾下降。建議四十歲以上民眾每年進行腎功能篩檢，早期發現並介入治療，可有效延緩腎功能惡化。',
          gold_score: 4
        },
        {
          id: 'read-002',
          text: '本研究採用多中心隨機雙盲對照試驗設計，以 Cox 比例風險模型分析主要複合終點事件（包含心血管死亡、非致命性心肌梗塞及非致命性腦中風），經校正基線共變量後，實驗組之風險比為 0.74（95% CI: 0.62–0.89, p=0.001）。',
          gold_score: 1
        },
        {
          id: 'read-003',
          text: '感冒了怎麼辦？多喝水、多休息是最基本的。如果發燒超過三天或症狀變嚴重，記得去看醫生喔！',
          gold_score: 5
        },
        {
          id: 'read-004',
          text: '高血壓是一種常見的慢性疾病，血壓持續偏高會增加心臟病和中風的風險。醫師通常會建議患者減少鹽分攝取、規律運動，必要時搭配降壓藥物治療。',
          gold_score: 4
        },
        {
          id: 'read-005',
          text: '於組織病理學切片中觀察到腺管上皮細胞異型增生，核質比增大伴有核分裂象，間質纖維化合併淋巴球浸潤，免疫組織化學染色 Ki-67 陽性率達 45%，符合高級別上皮內瘤變之診斷標準。',
          gold_score: 1
        }
      ]
    },

    T005: {
      taskCategories: ['regression'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'multi_dim',
          config: {
            dimensions: [
              { name: 'fluency', min: 1, max: 5, step: 1 },
              { name: 'adequacy', min: 1, max: 5, step: 1 },
              { name: 'coherence', min: 1, max: 5, step: 1 }
            ]
          }
        }
      ],
      // Judgment call: "source" is the reference-language text needed to judge
      // adequacy but is not itself the item being scored, so it is mapped as
      // evidence (background) rather than input; "translation" is the scored item.
      fieldRoleMap: { source: 'evidence', translation: 'input', gold_scores: 'output' },
      datasetFileName: 'multi-dim.json',
      datasetRecords: [
        {
          id: 'mt-001',
          source: 'Chronic kidney disease (CKD) is defined as abnormalities of kidney structure or function, present for more than 3 months, with implications for health.',
          translation: '慢性腎臟病（CKD）定義為腎臟結構或功能異常，持續超過三個月，且對健康有影響。',
          gold_scores: { fluency: 5, adequacy: 5, coherence: 5 }
        },
        {
          id: 'mt-002',
          source: 'The patient presented with acute onset of chest pain radiating to the left arm, associated with diaphoresis and dyspnea.',
          translation: '病人出現急性胸痛放射到左手臂，伴隨流汗和呼吸困難的表現。',
          gold_scores: { fluency: 3, adequacy: 4, coherence: 3 }
        },
        {
          id: 'mt-003',
          source: 'Randomized controlled trials provide the highest level of evidence for evaluating treatment efficacy.',
          translation: '隨機控制試驗提供了評估治療效果的最高等級證據。',
          gold_scores: { fluency: 5, adequacy: 5, coherence: 5 }
        },
        {
          id: 'mt-004',
          source: 'Immunoglobulin E–mediated hypersensitivity reactions can manifest as urticaria, angioedema, or anaphylaxis.',
          translation: '免疫球蛋白E介導的過敏反應可以表現為蕁麻疹、血管性水腫或過敏性休克。',
          gold_scores: { fluency: 4, adequacy: 5, coherence: 4 }
        },
        {
          id: 'mt-005',
          source: 'Early ambulation after surgery reduces the risk of deep vein thrombosis and promotes faster recovery.',
          translation: '手術後早點下床走路可以減少深層靜脈血栓的風險，而且恢復也會比較快。',
          gold_scores: { fluency: 5, adequacy: 4, coherence: 5 }
        }
      ]
    },

    T006: {
      taskCategories: ['sequence'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'sequence_tagging',
          config: {
            entities: [
              { name: 'PER', color: '#EC4899' },
              { name: 'ORG', color: '#0EA5E9' },
              { name: 'LOC', color: '#10B981' },
              { name: 'TIME', color: '#F59E0B' }
            ],
            snap_unit: 'character',
            allow_bypass: true
          }
        }
      ],
      fieldRoleMap: { text: 'input', spans: 'output' },
      datasetFileName: 'sequence-tagging.json',
      datasetRecords: [
        {
          id: 'sequence-tagging-001',
          text: '台積電董事長魏哲家今天出席台北國際半導體論壇並發表主題演講',
          spans: [{ start: 0, end: 3, label: 'ORG' }, { start: 6, end: 9, label: 'PER' }, { start: 9, end: 11, label: 'TIME' }, { start: 13, end: 15, label: 'LOC' }]
        },
        {
          id: 'sequence-tagging-002',
          text: '衛福部部長薛瑞元於三月十五日宣布全國COVID-19疫苗第四劑接種計畫',
          spans: [{ start: 0, end: 3, label: 'ORG' }, { start: 5, end: 8, label: 'PER' }, { start: 9, end: 14, label: 'TIME' }]
        },
        {
          id: 'sequence-tagging-003',
          text: '長庚醫院急診醫學部主任陳日昌指出桃園地區流感病患持續增加',
          spans: [{ start: 0, end: 4, label: 'ORG' }, { start: 11, end: 14, label: 'PER' }, { start: 16, end: 18, label: 'LOC' }]
        },
        {
          id: 'sequence-tagging-004',
          text: 'The chairman of TSMC attended the forum in Taipei today.',
          spans: [{ start: 16, end: 20, label: 'ORG' }, { start: 43, end: 49, label: 'LOC' }, { start: 50, end: 55, label: 'TIME' }]
        }
      ]
    },

    T007: {
      taskCategories: ['sequence'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'entity_recognition',
          config: {
            entities: [
              { name: 'target', color: '#0EA5E9' },
              { name: 'aspect', color: '#10B981' },
              { name: 'opinion', color: '#EC4899' }
            ],
            allow_overlapping: false
          }
        }
      ],
      fieldRoleMap: { text: 'input', gold_entities: 'output' },
      datasetFileName: 'entity-recognition.json',
      datasetRecords: [
        {
          id: 'entity-recognition-001',
          text: '這款筆電的螢幕解析度非常高，色彩還原度也很好，但鍵盤手感偏硬，打字久了手指會痠。',
          gold_entities: [
            { text: '筆電', type: 'target', start: 2, end: 3 },
            { text: '螢幕解析度', type: 'aspect', start: 5, end: 9 },
            { text: '非常高', type: 'opinion', start: 10, end: 12 },
            { text: '色彩還原度', type: 'aspect', start: 14, end: 18 },
            { text: '很好', type: 'opinion', start: 20, end: 21 },
            { text: '鍵盤手感', type: 'aspect', start: 24, end: 27 },
            { text: '偏硬', type: 'opinion', start: 28, end: 29 }
          ]
        },
        {
          id: 'entity-recognition-002',
          text: '飯店的地理位置絕佳，步行五分鐘就到捷運站，房間乾淨但隔音效果差，半夜都能聽到走廊的聲音。',
          gold_entities: [
            { text: '飯店', type: 'target', start: 0, end: 1 },
            { text: '地理位置', type: 'aspect', start: 3, end: 6 },
            { text: '絕佳', type: 'opinion', start: 7, end: 8 },
            { text: '房間', type: 'target', start: 21, end: 22 },
            { text: '隔音效果', type: 'aspect', start: 26, end: 29 },
            { text: '差', type: 'opinion', start: 30, end: 30 }
          ]
        },
        {
          id: 'entity-recognition-003',
          text: '這家餐廳的牛排煎得恰到好處，外酥內嫩，但服務速度太慢，等了四十分鐘才上菜。',
          gold_entities: [
            { text: '餐廳', type: 'target', start: 2, end: 3 },
            { text: '牛排', type: 'aspect', start: 5, end: 6 },
            { text: '恰到好處', type: 'opinion', start: 9, end: 12 },
            { text: '服務速度', type: 'aspect', start: 20, end: 23 },
            { text: '太慢', type: 'opinion', start: 24, end: 25 }
          ]
        }
      ]
    },

    T008: {
      taskCategories: ['sequence'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'relation_identification',
          config: {
            relation_types: ['causes', 'treats', 'prevents', 'diagnoses', 'located_in']
          }
        }
      ],
      // Judgment call: "entities" are pre-recognized spans given as scaffolding
      // (entity_recognition is not an output type for this task), so they are
      // mapped as evidence. "relation_types" per record enumerates the gold
      // relation categories actually present in "triples", so it is treated
      // as output alongside "triples" rather than as neutral metadata.
      fieldRoleMap: {
        text: 'input',
        entities: 'evidence',
        relation_types: 'output',
        triples: 'output'
      },
      datasetFileName: 'relation-identification.json',
      datasetRecords: [
        {
          id: 'rel-001',
          text: '高血壓若未妥善控制，可能導致動脈硬化，進而引發冠狀動脈心臟病或腦中風。長期服用降壓藥物如 Amlodipine 有助於控制血壓，降低併發症風險。',
          entities: [
            { text: '高血壓', type: 'DISE', start: 0, end: 2 },
            { text: '動脈硬化', type: 'SYMP', start: 14, end: 17 },
            { text: '冠狀動脈心臟病', type: 'DISE', start: 23, end: 29 },
            { text: '腦中風', type: 'DISE', start: 31, end: 33 },
            { text: 'Amlodipine', type: 'DRUG', start: 45, end: 54 }
          ],
          relation_types: ['causes', 'treats'],
          triples: [
            {
              entity1: { text: '高血壓', start: 0, end: 2 },
              relation: { text: '導致', start: 12, end: 13 },
              relation_type: 'causes',
              entity2: { text: '動脈硬化', start: 14, end: 17 }
            },
            {
              entity1: { text: '動脈硬化', start: 14, end: 17 },
              relation: { text: '引發', start: 21, end: 22 },
              relation_type: 'causes',
              entity2: { text: '冠狀動脈心臟病', start: 23, end: 29 }
            },
            {
              entity1: { text: '動脈硬化', start: 14, end: 17 },
              relation: { text: '引發', start: 21, end: 22 },
              relation_type: 'causes',
              entity2: { text: '腦中風', start: 31, end: 33 }
            },
            {
              entity1: { text: 'Amlodipine', start: 45, end: 54 },
              relation: { text: '控制', start: 59, end: 60 },
              relation_type: 'treats',
              entity2: { text: '高血壓', start: 0, end: 2 }
            }
          ]
        },
        {
          id: 'rel-002',
          text: '糖尿病視網膜病變是糖尿病的常見併發症，好發於眼底視網膜微血管。定期眼底鏡檢查可早期診斷，雷射光凝固術可有效防止病變惡化。',
          entities: [
            { text: '糖尿病視網膜病變', type: 'DISE', start: 0, end: 7 },
            { text: '糖尿病', type: 'DISE', start: 9, end: 11 },
            { text: '視網膜微血管', type: 'BODY', start: 24, end: 29 },
            { text: '眼底鏡檢查', type: 'EXAM', start: 33, end: 37 },
            { text: '雷射光凝固術', type: 'TREAT', start: 44, end: 49 }
          ],
          relation_types: ['causes', 'located_in', 'diagnoses', 'treats'],
          triples: [
            {
              entity1: { text: '糖尿病', start: 9, end: 11 },
              relation: { text: '併發', start: 15, end: 16 },
              relation_type: 'causes',
              entity2: { text: '糖尿病視網膜病變', start: 0, end: 7 }
            },
            {
              entity1: { text: '糖尿病視網膜病變', start: 0, end: 7 },
              relation: { text: '好發於', start: 19, end: 21 },
              relation_type: 'located_in',
              entity2: { text: '視網膜微血管', start: 24, end: 29 }
            },
            {
              entity1: { text: '眼底鏡檢查', start: 33, end: 37 },
              relation: { text: '診斷', start: 41, end: 42 },
              relation_type: 'diagnoses',
              entity2: { text: '糖尿病視網膜病變', start: 0, end: 7 }
            },
            {
              entity1: { text: '雷射光凝固術', start: 44, end: 49 },
              relation: { text: '防止', start: 53, end: 54 },
              relation_type: 'treats',
              entity2: { text: '糖尿病視網膜病變', start: 0, end: 7 }
            }
          ]
        },
        {
          id: 'rel-003',
          text: '氣喘患者吸入過敏原後，支氣管平滑肌會痙攣收縮，導致呼吸困難。吸入型類固醇如 Budesonide 可抑制氣道發炎，預防氣喘發作。',
          entities: [
            { text: '氣喘', type: 'DISE', start: 0, end: 1 },
            { text: '支氣管平滑肌', type: 'BODY', start: 11, end: 16 },
            { text: '呼吸困難', type: 'SYMP', start: 25, end: 28 },
            { text: 'Budesonide', type: 'DRUG', start: 38, end: 47 }
          ],
          relation_types: ['causes', 'treats', 'prevents'],
          triples: [
            {
              entity1: { text: '氣喘', start: 0, end: 1 },
              relation: { text: '導致', start: 23, end: 24 },
              relation_type: 'causes',
              entity2: { text: '呼吸困難', start: 25, end: 28 }
            },
            {
              entity1: { text: 'Budesonide', start: 38, end: 47 },
              relation: { text: '抑制', start: 50, end: 51 },
              relation_type: 'treats',
              entity2: { text: '氣喘', start: 0, end: 1 }
            },
            {
              entity1: { text: 'Budesonide', start: 38, end: 47 },
              relation: { text: '預防', start: 57, end: 58 },
              relation_type: 'prevents',
              entity2: { text: '氣喘', start: 0, end: 1 }
            }
          ]
        }
      ]
    },

    T009: {
      taskCategories: ['generation'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'free_text',
          config: {
            max_length: 256
          }
        }
      ],
      // Judgment call: "reference" is a shorter, separately authored reference
      // summary used as background/comparison context; "gold_answer" is the
      // actual gold free-text target, so only it is mapped as output.
      fieldRoleMap: { text: 'input', reference: 'evidence', gold_answer: 'output' },
      datasetFileName: 'free-text.json',
      datasetRecords: [
        {
          id: 'sum-001',
          text: '台灣癌症五年存活率已突破六成，除了治癒疾病，心理健康支持也備受重視。國內外研究顯示，近半數癌症患者出現明顯情緒困擾，三至四成病患有焦慮或憂鬱反應。癌症希望基金會今年在台北設立全台首家專屬癌友與家屬的心理諮商所，提供每人最多六次免費個別諮商，由專業心理師陪伴癌友修復內在韌性。',
          reference: '癌症希望基金會在台北成立癌友專屬心理諮商所，提供最多六次免費諮商服務，因近半癌友有情緒困擾。',
          gold_answer: '台灣癌症存活率逾六成，但近半患者有情緒困擾。癌症希望基金會於台北設立專屬諮商所，提供每人最多六次免費心理諮商。'
        },
        {
          id: 'sum-002',
          text: '第二型糖尿病的治療以生活型態改變為基礎，包括飲食控制與規律運動。當血糖仍未達標時，醫師通常會優先處方 Metformin，因其安全性高、價格低廉，且有助於體重控制。若 Metformin 不耐受或禁忌，可考慮 SGLT-2 抑制劑或 GLP-1 受體促效劑，後者尚有心血管保護效益。',
          reference: '第二型糖尿病先調整生活型態，藥物首選 Metformin，不耐受者可改用 SGLT-2 或 GLP-1 類藥物。',
          gold_answer: '糖尿病治療以飲食與運動為基礎，藥物首選 Metformin，若不耐受可改用 SGLT-2 抑制劑或 GLP-1 促效劑。'
        },
        {
          id: 'sum-003',
          text: '居家血壓監測有助於提供更真實的血壓數據，建議每天早晨起床後、服藥前，以及晚上睡前各量一次，每次坐姿休息五分鐘後再測量，連續記錄七天。飲食方面，得舒飲食法已有充分證據可降低血壓，強調多攝取蔬果、全穀類、低脂乳製品，並減少紅肉、含糖飲料與高鈉食物。每日鈉攝取建議控制在 2,300 毫克以下。',
          reference: '居家量血壓應早晚各一次、休息五分鐘後測量、連續記錄七天；飲食採得舒飲食法，控制鈉攝取。',
          gold_answer: '居家血壓監測建議早晚各量一次，休息五分鐘後測量並連續記錄七天。飲食建議採用得舒飲食法，每日鈉攝取控制在 2,300 毫克以下。'
        }
      ]
    },

    T010: {
      taskCategories: ['sequence'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'entity_recognition',
          config: {
            entities: [
              { name: 'BODY', color: '#6366F1' },
              { name: 'DISE', color: '#EC4899' },
              { name: 'SYMP', color: '#F59E0B' },
              { name: 'DRUG', color: '#10B981' },
              { name: 'INST', color: '#8B5CF6' },
              { name: 'SUPP', color: '#14B8A6' },
              { name: 'EXAM', color: '#F97316' },
              { name: 'TREAT', color: '#0EA5E9' },
              { name: 'CHEM', color: '#6366F1' },
              { name: 'TIME', color: '#10B981' }
            ],
            allow_overlapping: false
          }
        },
        {
          type: 'relation_identification',
          config: {
            relation_types: [
              'bodyLocation',
              'causes',
              'adverseOutcome',
              'typicalTest',
              'diagnosis',
              'possibleTreatment',
              'signOrSymptom',
              'prevents'
            ],
            source_output: 'entity_recognition'
          }
        }
      ],
      // Unlike T008, entity_recognition IS an output type here, so "entities"
      // is gold output data (not scaffolding evidence).
      fieldRoleMap: {
        text: 'input',
        entities: 'output',
        relation_types: 'output',
        triples: 'output'
      },
      datasetFileName: 'medical-ner-re.json',
      datasetRecords: [
        {
          id: 'med-001',
          text: '而左心耳位於左心房前外側，是一個囊袋狀、突起的小空腔，容易在心房顫動時於左心耳內產生淤滯，形成血栓，血栓脫落流至腦部或其他器官時，即會造成腦中風或甚至全身性栓塞。',
          entities: [
            { text: '左心耳', type: 'BODY', start: 1, end: 3 },
            { text: '左心房', type: 'BODY', start: 6, end: 8 },
            { text: '心房', type: 'BODY', start: 30, end: 31 },
            { text: '左心耳', type: 'BODY', start: 36, end: 38 },
            { text: '淤滯', type: 'SYMP', start: 42, end: 43 },
            { text: '血栓', type: 'SYMP', start: 47, end: 48 },
            { text: '血栓', type: 'SYMP', start: 50, end: 51 },
            { text: '腦部', type: 'BODY', start: 56, end: 57 },
            { text: '器官', type: 'BODY', start: 61, end: 62 },
            { text: '腦中風', type: 'DISE', start: 69, end: 71 },
            { text: '全身性栓塞', type: 'DISE', start: 75, end: 79 }
          ],
          relation_types: ['bodyLocation', 'causes', 'adverseOutcome'],
          triples: [
            {
              entity1: { text: '左心耳', start: 1, end: 3 },
              relation: { text: '位於', start: 4, end: 5 },
              relation_type: 'bodyLocation',
              entity2: { text: '左心房', start: 6, end: 8 }
            },
            {
              entity1: { text: '左心耳', start: 1, end: 3 },
              relation: { text: '產生', start: 40, end: 41 },
              relation_type: 'causes',
              entity2: { text: '淤滯', start: 42, end: 43 }
            },
            {
              entity1: { text: '左心耳', start: 1, end: 3 },
              relation: { text: '形成', start: 45, end: 46 },
              relation_type: 'causes',
              entity2: { text: '血栓', start: 47, end: 48 }
            },
            {
              entity1: { text: '淤滯', start: 42, end: 43 },
              relation: { text: '形成', start: 45, end: 46 },
              relation_type: 'causes',
              entity2: { text: '血栓', start: 47, end: 48 }
            },
            {
              entity1: { text: '血栓', start: 50, end: 51 },
              relation: { text: '流至', start: 54, end: 55 },
              relation_type: 'bodyLocation',
              entity2: { text: '腦部', start: 56, end: 57 }
            },
            {
              entity1: { text: '血栓', start: 50, end: 51 },
              relation: { text: '流至', start: 54, end: 55 },
              relation_type: 'bodyLocation',
              entity2: { text: '器官', start: 61, end: 62 }
            },
            {
              entity1: { text: '血栓', start: 50, end: 51 },
              relation: { text: '造成', start: 67, end: 68 },
              relation_type: 'adverseOutcome',
              entity2: { text: '腦中風', start: 69, end: 71 }
            },
            {
              entity1: { text: '血栓', start: 50, end: 51 },
              relation: { text: '造成', start: 67, end: 68 },
              relation_type: 'adverseOutcome',
              entity2: { text: '全身性栓塞', start: 75, end: 79 }
            }
          ]
        },
        {
          id: 'med-002',
          text: '患者因胸痛至急診就醫，經心電圖檢查發現ST段上升，診斷為急性心肌梗塞，醫師立即給予阿斯匹靈及肝素治療，並安排心導管介入手術。',
          entities: [
            { text: '胸痛', type: 'SYMP', start: 3, end: 4 },
            { text: '急診', type: 'INST', start: 6, end: 7 },
            { text: '心電圖', type: 'EXAM', start: 12, end: 14 },
            { text: 'ST段上升', type: 'SYMP', start: 19, end: 23 },
            { text: '急性心肌梗塞', type: 'DISE', start: 28, end: 33 },
            { text: '阿斯匹靈', type: 'DRUG', start: 41, end: 44 },
            { text: '肝素', type: 'DRUG', start: 46, end: 47 },
            { text: '心導管介入手術', type: 'TREAT', start: 54, end: 60 }
          ],
          relation_types: ['typicalTest', 'diagnosis', 'possibleTreatment'],
          triples: [
            {
              entity1: { text: '心電圖', start: 12, end: 14 },
              relation: { text: '發現', start: 17, end: 18 },
              relation_type: 'typicalTest',
              entity2: { text: 'ST段上升', start: 19, end: 23 }
            },
            {
              entity1: { text: 'ST段上升', start: 19, end: 23 },
              relation: { text: '診斷', start: 25, end: 26 },
              relation_type: 'diagnosis',
              entity2: { text: '急性心肌梗塞', start: 28, end: 33 }
            },
            {
              entity1: { text: '阿斯匹靈', start: 41, end: 44 },
              relation: { text: '治療', start: 48, end: 49 },
              relation_type: 'possibleTreatment',
              entity2: { text: '急性心肌梗塞', start: 28, end: 33 }
            },
            {
              entity1: { text: '肝素', start: 46, end: 47 },
              relation: { text: '治療', start: 48, end: 49 },
              relation_type: 'possibleTreatment',
              entity2: { text: '急性心肌梗塞', start: 28, end: 33 }
            }
          ]
        },
        {
          id: 'med-003',
          text: '糖尿病患者長期血糖控制不佳，容易引發視網膜病變及腎病變，需定期至眼科進行眼底檢查，並使用Metformin控制血糖。',
          entities: [
            { text: '糖尿病', type: 'DISE', start: 0, end: 2 },
            { text: '血糖控制不佳', type: 'SYMP', start: 7, end: 12 },
            { text: '視網膜病變', type: 'DISE', start: 18, end: 22 },
            { text: '腎病變', type: 'DISE', start: 24, end: 26 },
            { text: '眼科', type: 'INST', start: 32, end: 33 },
            { text: '眼底檢查', type: 'EXAM', start: 36, end: 39 },
            { text: 'Metformin', type: 'DRUG', start: 44, end: 52 }
          ],
          relation_types: ['causes', 'typicalTest', 'possibleTreatment'],
          triples: [
            {
              entity1: { text: '糖尿病', start: 0, end: 2 },
              relation: { text: '引發', start: 16, end: 17 },
              relation_type: 'causes',
              entity2: { text: '視網膜病變', start: 18, end: 22 }
            },
            {
              entity1: { text: '糖尿病', start: 0, end: 2 },
              relation: { text: '引發', start: 16, end: 17 },
              relation_type: 'causes',
              entity2: { text: '腎病變', start: 24, end: 26 }
            },
            {
              entity1: { text: '眼底檢查', start: 36, end: 39 },
              relation: { text: '檢查', start: 38, end: 39 },
              relation_type: 'typicalTest',
              entity2: { text: '視網膜病變', start: 18, end: 22 }
            },
            {
              entity1: { text: 'Metformin', start: 44, end: 52 },
              relation: { text: '使用', start: 42, end: 43 },
              relation_type: 'possibleTreatment',
              entity2: { text: '糖尿病', start: 0, end: 2 }
            }
          ]
        }
      ]
    },

    T011: {
      taskCategories: ['classification'],
      taskInputTypes: ['item_pair'],
      outputs: [
        {
          type: 'single_label',
          config: {
            label_options: [
              { name: 'entailment', color: '#10B981' },
              { name: 'neutral', color: '#F59E0B' },
              { name: 'contradiction', color: '#EC4899' }
            ]
          }
        }
      ],
      // "Evidence" here is a rationale explaining the gold Label, so it also
      // reveals ground truth and is mapped as output, not the "evidence" role.
      // "Title", "Source ID", "Source URL", "ID" are left unassigned metadata.
      fieldRoleMap: {
        Premise: 'input',
        Hypothesis: 'input',
        Label: 'output',
        Evidence: 'output'
      },
      datasetFileName: 'nli.json',
      datasetRecords: [
        {
          ID: '00183',
          Title: '麻醉科',
          Premise: '運動員可能出現每分鐘小於60跳的心搏過緩；但若心跳每分鐘僅30跳以下，術前仍需由心臟內科醫師確認心臟生理…（畫面截斷）',
          Hypothesis: '每分鐘30跳以下的心搏過緩在術前可按運動員生理性心搏過緩處理，適合直接接受脊椎手術，心臟內科安全性…（畫面截斷）',
          Label: 'contradiction',
          Evidence: '運動員有可能有"心搏過緩"(每分鐘小於60跳)的狀態。但是如每分鐘僅有30跳以下，術前仍有必要請心臟內科醫師…（畫面截斷）',
          'Source ID': '32895f62',
          'Source URL': 'https://sp1.hso.mohw.gov.tw/doctor/All/ShowDetail.php?q_no=151387'
        },
        {
          ID: '00184',
          Title: '心臟科',
          Premise: '阿斯匹靈可抑制血小板凝集，常用於預防心肌梗塞與中風，但長期服用可能增加胃腸道出血風險，需定期追蹤。',
          Hypothesis: '阿斯匹靈對所有心血管疾病患者均無副作用，可長期安全服用，不需醫師監控。',
          Label: 'contradiction',
          Evidence: '長期服用阿斯匹靈可能增加胃腸道出血風險，因此需在醫師指導下定期追蹤，而非任意自行長期服用。',
          'Source ID': '48a1c9e3',
          'Source URL': 'https://sp1.hso.mohw.gov.tw/doctor/All/ShowDetail.php?q_no=203451'
        },
        {
          ID: '00185',
          Title: '腎臟科',
          Premise: '慢性腎臟病患者應限制蛋白質攝取，以減少含氮廢物堆積；但同時需維持足夠熱量，避免營養不良。',
          Hypothesis: '慢性腎臟病患者在限制蛋白質攝取的同時，必須確保充足的熱量供應以避免肌肉消耗。',
          Label: 'entailment',
          Evidence: '限制蛋白質攝取須搭配足夠熱量，否則身體會分解肌肉蛋白質產生能量，反而加重腎臟負擔。',
          'Source ID': '71f3d2b8',
          'Source URL': 'https://sp1.hso.mohw.gov.tw/doctor/All/ShowDetail.php?q_no=318762'
        }
      ]
    },

    T012: {
      taskCategories: ['generation'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'free_text',
          config: {
            max_length: 512
          }
        }
      ],
      // Judgment call: "instruction" is shown to frame every item so it is
      // mapped as input alongside "question"; "background" is explicitly
      // 背景知識 (background knowledge) so it maps to evidence.
      // "article_id" and "angle" are left unassigned metadata.
      fieldRoleMap: {
        instruction: 'input',
        background: 'evidence',
        question: 'input',
        answer: 'output'
      },
      datasetFileName: 'mrc.json',
      datasetRecords: [
        {
          article_id: 'eac8d013',
          angle: '病因與症狀',
          instruction: '你是一個專業的 AI 醫療助手。請根據提供的背景知識，回答患者的問題。',
          background: '【背景知識】：\n標題：近半癌友有情緒困擾，今年起可享最多6次免費心理諮商\n內容：\n台灣癌症 5 年存活率已突破 6 成，除了治癒疾病，心理健康支持也備受重視。國內外研究顯示，近半數癌症患者出現明顯情緒困擾，3 至 4 成病患有焦慮或憂鬱反應，將增加癌症死亡率及死亡率。對此癌症希望基金會設立全台首家專屬癌友與家屬的心理諮商所，今年起提供每人最多 6 次免費心理諮商，由專業心理師陪伴癌友及病家修復內在韌性，找回與病前行的力量。\n根據國健署 111 年癌症登記報告，平均每 4 分 2 秒就有一個家庭被癌症打亂生活節奏，癌友須面對確診衝擊、治癒焦慮、復發擔憂與預後不確幸，也會經歷身體形象改變、自我認同重建及回歸生活的適應歷程。\n癌症希望基金會執行長蘇連瓔指出，癌後心理照護長期缺乏性統性資源，費用負擔大、可近性低，2018 年基金會在台北、台中和高雄提供癌友及家屬心理諮商服務，並納入癌後性諮詢，近 3 年累計服務近 500 人次。\n為提升服務量能和可近性，今年基金會在台北新設專屬癌友及家屬的心理諮商所，並由心理師視個案需求，提供每人最多 6 次免費個別諮商，或最多 4 次伴侶、家庭諮商。曾抗癌長達 20 多年的所長葉北辰表示，心理師將在整個疾病路程陪伴癌友，同時協助癌友處理睡眠困擾或癌因性疲憊、醫病溝通與醫療決策思考，並透過正念減壓與身心整合練習，幫助身體與心理重新對話，家屬也能放下重擔。\n若癌友在治療過程中產生新疑慮與照護需求，心理師將同步轉介其他資源，由護理師和社工師提供相關服務，形成完整身心照護網。基金會表示，心理諮師所已開放預約，初次提供實體心理諮商服務，預計 2 月增設通訊遠距心理諮商服務，民眾可撥打免費服務專線 0809-010-580 預約或洽詢。\n\n',
          question: '我罹癌後一直很焦慮、睡不好又覺得很累，這是癌症常見的情緒症狀嗎？通常是哪些原因造成的？',
          answer: '是的，這在癌友身上其實很常見。我會跟您說，癌症不只影響身體，心理也常一起承受很大壓力。近半數癌症患者會出現明顯情緒困擾，大約 3 到 4 成會有焦慮或憂鬱反應。常見原因包括剛確診時的衝擊、對治療效果的焦慮、擔心復發、對預後的不確定感，以及治療過程中面對身體形象改變、自我認同重建和回歸生活的適應壓力。這些心理負擔也可能伴隨睡眠困擾或癌因性疲憊，讓人覺得特別累、特別撐不住。若這些情況已經影響生活，建議盡早尋求心理支持，讓專業人員陪您一起處理，對身心都很重要。'
        },
        {
          article_id: 'b3f72c91',
          angle: '治療與用藥',
          instruction: '你是一個專業的 AI 醫療助手。請根據提供的背景知識，回答患者的問題。',
          background: '【背景知識】：\n標題：糖尿病患者的血糖控制與口服藥物選擇\n內容：\n第二型糖尿病的治療以生活型態改變為基礎，包括飲食控制與規律運動。當血糖仍未達標時，醫師通常會優先處方 Metformin，因其安全性高、價格低廉，且有助於體重控制。若 Metformin 不耐受或禁忌，可考慮 SGLT-2 抑制劑或 GLP-1 受體促效劑，後者尚有心血管保護效益。胰島素通常用於口服藥物血糖控制不佳或有特殊臨床狀況時。所有藥物的選擇須依個別患者的腎功能、心血管風險及經濟負擔綜合考量。\n\n',
          question: '醫師說我的血糖控制不好，要開始吃藥，第一線通常會用什麼藥？有什麼副作用嗎？',
          answer: '第二型糖尿病的第一線口服藥物通常是 Metformin。它的主要優點是安全、便宜，而且不容易造成低血糖，還可能幫助體重稍微下降。常見副作用主要是腸胃道不適，例如噁心、腹瀉，通常隨餐服用或從低劑量開始可以減少不適。如果您有腎功能問題，醫師可能會考慮其他選項，例如 SGLT-2 抑制劑或 GLP-1 促效劑，這些藥物對心臟也有額外保護效果。建議與您的主治醫師討論最適合您個人狀況的選擇。'
        },
        {
          article_id: 'd9a14e57',
          angle: '預防與生活照護',
          instruction: '你是一個專業的 AI 醫療助手。請根據提供的背景知識，回答患者的問題。',
          background: '【背景知識】：\n標題：高血壓患者的居家血壓監測與飲食建議\n內容：\n居家血壓監測有助於提供更真實的血壓數據，建議每天早晨起床後、服藥前，以及晚上睡前各量一次，每次坐姿休息 5 分鐘後再測量，連續記錄 7 天。飲食方面，DASH 飲食法（得舒飲食）已有充分證據可降低血壓，強調多攝取蔬果、全穀類、低脂乳製品，並減少紅肉、含糖飲料與高鈉食物。每日鈉攝取建議控制在 2,300 毫克以下，理想目標為 1,500 毫克。規律有氧運動（每週至少 150 分鐘中等強度）及維持健康體重亦是重要的非藥物介入。\n\n',
          question: '我最近被診斷有高血壓，醫師叫我先觀察生活習慣，請問在家要怎麼量血壓才準確？飲食上要注意什麼？',
          answer: '在家量血壓要準確，有幾個重點：建議每天早上起床後和晚上睡前各量一次，量之前先坐著休息 5 分鐘，不要剛運動完或喝完咖啡就量。手臂與心臟保持同高，連續記錄至少一週，再帶給醫師參考。飲食方面，最重要的是減少鹽分，每天鈉的攝取量盡量不超過 2,300 毫克，少吃加工食品和外食。可以參考「得舒飲食」，多吃蔬菜水果、全穀類和低脂乳品。配合規律運動和維持健康體重，對血壓控制很有幫助。'
        }
      ]
    },

    T013: {
      taskCategories: ['sequence', 'regression'],
      taskInputTypes: ['single_item'],
      outputs: [
        {
          type: 'entity_recognition',
          config: {
            entities: [
              { name: 'Target', color: '#0EA5E9' },
              { name: 'Aspect', color: '#10B981' },
              { name: 'Opinion', color: '#EC4899' }
            ],
            allow_overlapping: true
          }
        },
        {
          type: 'relation_identification',
          config: {
            relation_types: ['has_aspect', 'has_opinion'],
            source_output: 'entity_recognition'
          }
        },
        {
          type: 'multi_dim',
          config: {
            dimensions: [
              { name: 'valence', min: 1, max: 9, step: 1 },
              { name: 'arousal', min: 1, max: 9, step: 1 }
            ]
          }
        }
      ],
      // "utterances" and "text" are two representations of the same
      // cross-utterance dialogue input; both are shown to the annotator.
      fieldRoleMap: {
        utterances: 'input',
        text: 'input',
        gold_triplets: 'output',
        incomplete_annotations: 'output'
      },
      datasetFileName: 'absa-va.json',
      datasetRecords: [
        {
          id: 'absa-001',
          utterances: [
            { utt_id: 0, speaker: 'rottenrockteahouse', text: '我入手Note 10 plus第三天就退廠保修\n過熱問題嚴重！差評' },
            { utt_id: 1, speaker: '張峯獎-f6w', text: '我已經拿了九天了就沒有這個問題你在唬爛' },
            { utt_id: 2, speaker: 'isbonny', text: '唉！在哪裡購買的呢？這款手機才上市兩天啊～' },
            { utt_id: 3, speaker: 'rottenrockteahouse', text: '@isbonny 澳門的代理商' },
            { utt_id: 4, speaker: 'rottenrockteahouse', text: '我在首發當天買' }
          ],
          text: '@rottenrockteahouse: 我入手Note 10 plus第三天就退廠保修 過熱問題嚴重！差評\n@張峯獎-f6w: 我已經拿了九天了就沒有這個問題你在唬爛\n@isbonny: 唉！在哪裡購買的呢？這款手機才上市兩天啊～\n@rottenrockteahouse: @isbonny 澳門的代理商\n@rottenrockteahouse: 我在首發當天買',
          gold_triplets: [
            {
              target_utt_id: 0,
              target_text: 'Note 10 plus',
              aspect_utt_id: 0,
              aspect_text: '過熱問題',
              opinion_utt_id: 0,
              opinion_text: '嚴重',
              cross_utterance: false,
              evidence_utt_ids: [0],
              notes: ''
            },
            {
              target_utt_id: 0,
              target_text: 'Note 10 plus',
              aspect_utt_id: 0,
              aspect_text: '過熱問題',
              opinion_utt_id: 1,
              opinion_text: '沒有這個問題',
              cross_utterance: true,
              evidence_utt_ids: [0, 1],
              notes: ''
            }
          ],
          incomplete_annotations: [
            {
              completeness: 'missing_aspect',
              target_utt_id: 0,
              target_text: 'Note 10 plus',
              aspect_utt_id: null,
              aspect_text: '',
              opinion_utt_id: 0,
              opinion_text: '差評',
              cross_utterance: false,
              evidence_utt_ids: [0],
              notes: ''
            }
          ]
        }
      ]
    },

    /* T014-T017: review-flow demo seeds. Same single_label sentiment
       schema (docs/product/task-configs/review-flow-*.json) with label
       colors mapped to the prototype palette exactly as T001 maps
       single-label.json; records copied verbatim from
       docs/product/example-data/review-flow-*.json. issue #596: the
       single-owner relay model has no quorum concept, so the retired
       per-task reviewer-count-threshold field (formerly `minReviewers`) is
       gone from every profile below. `reviewerIds` / `arbiterIds` seed the
       014 TaskDetail entity's roster fields (`reviewer_ids` / `arbiter_ids`,
       ARBITER_CANDIDATE_RULE below) for the review-flow demo tasks; every
       reviewer listed also appears in TASK_MEMBERS (task-detail.html) with
       `taskRole: 'reviewer'`. None of these profiles set
       `forceShowGuideline` (issue #395) -- they keep the shared false
       default on both task-detail.html's overview and
       annotation-workspace.data.js's resolveTaskProfile(), same as every
       other profile in this file. `reviewerGuidelineText` (issue #405)
       seeds the per-task "提供給審核員" overview content: the shared
       sentiment label-boundary criteria plus each task's own review-model
       addendum, so a reviewer opening the task sees guidance that matches
       that task's actual review scenario instead of the shared empty
       state. */
    T014: {
      taskCategories: ['classification'],
      taskInputTypes: ['single_item'],
      reviewerIds: ['user_mandy', 'user_kevin', 'user_rachel'],
      arbiterIds: ['user_mandy'],
      outputs: [
        {
          type: 'single_label',
          config: {
            label_options: [
              { name: 'positive', color: '#10B981' },
              { name: 'neutral', color: '#F59E0B' },
              { name: 'negative', color: '#EC4899' }
            ]
          }
        }
      ],
      fieldRoleMap: { text: 'input', gold_label: 'output' },
      reviewerGuidelineText:
        REVIEWER_GUIDELINE_SENTIMENT_BOUNDARY_ZH +
        '（T014）本任務為 dry_run 共識校準情境，審核門檻為 1 位審核員；出現 ' +
        'dry-03-dispute-open、dry-04-dispute-resolved 等標記員分歧的項目時，' +
        '需由具 can_arbitrate 權限的審核員仲裁決定最終標籤，不可逕自採多數意見核可。',
      datasetFileName: 'review-flow-dry-run.json',
      datasetRecords: [
        {
          id: 'dry-01-all-agree',
          text: '餐點份量十足，服務生態度親切，上菜速度也很快，整體用餐體驗非常好。',
          gold_label: 'positive'
        },
        {
          id: 'dry-02-one-divergent',
          text: '口味還不錯，但價格偏高，如果有折扣的話應該會再訪。',
          gold_label: 'neutral'
        },
        {
          id: 'dry-03-dispute-open',
          text: '環境普通，餐點也沒什麼特色，不算難吃但應該不會特地再來。',
          gold_label: 'neutral'
        },
        {
          id: 'dry-04-dispute-resolved',
          text: '服務人員把飲料打翻在我外套上，雖然有道歉但處理態度很敷衍。',
          gold_label: 'negative'
        },
        {
          id: 'dry-05-pending-review',
          text: '甜點是隱藏亮點，尤其是烤布蕾，外層焦糖的脆度恰到好處。',
          gold_label: 'positive'
        }
      ]
    },

    T015: {
      taskCategories: ['classification'],
      taskInputTypes: ['single_item'],
      reviewerIds: ['user_mandy', 'user_kevin', 'user_rachel'],
      arbiterIds: ['user_mandy'],
      outputs: [
        {
          type: 'single_label',
          config: {
            label_options: [
              { name: 'positive', color: '#10B981' },
              { name: 'neutral', color: '#F59E0B' },
              { name: 'negative', color: '#EC4899' }
            ]
          }
        }
      ],
      fieldRoleMap: { text: 'input', gold_label: 'output' },
      reviewerGuidelineText:
        REVIEWER_GUIDELINE_SENTIMENT_BOUNDARY_ZH +
        '（T015）本任務為正式標記單一審核員核可情境，審核門檻為 1 位審核員；' +
        '審核員可直接核可（approved）或修改（modified）標記員的標註結果，如 ' +
        'ofs-02-modified-dispute 項目。',
      datasetFileName: 'review-flow-official-single.json',
      datasetRecords: [
        {
          id: 'ofs-01-agree-gold',
          text: '等了四十分鐘餐點才上桌，牛排要的五分熟卻煎到全熟，體驗很差。',
          gold_label: 'negative'
        },
        {
          id: 'ofs-02-modified-dispute',
          text: '整體來說中規中矩，飲料好喝但主餐略鹹，看個人接受度。',
          gold_label: 'neutral'
        },
        {
          id: 'ofs-03-arbitrated-gold',
          text: '店面剛裝潢過，座位變得舒適許多，不過菜單品項也變少了。',
          gold_label: 'neutral'
        },
        {
          id: 'ofs-04-pending-review',
          text: '主廚特餐每天不同，今天的燉飯米心軟硬適中，醬汁也很入味。',
          gold_label: 'positive'
        },
        {
          id: 'ofs-05-not-submitted',
          text: '老闆娘會記得常客的喜好，這種人情味在連鎖餐廳感受不到。',
          gold_label: 'positive'
        }
      ]
    },

    T016: {
      taskCategories: ['classification'],
      taskInputTypes: ['single_item'],
      reviewerIds: ['user_mandy', 'user_kevin', 'user_rachel'],
      arbiterIds: ['user_mandy'],
      outputs: [
        {
          type: 'single_label',
          config: {
            label_options: [
              { name: 'positive', color: '#10B981' },
              { name: 'neutral', color: '#F59E0B' },
              { name: 'negative', color: '#EC4899' }
            ]
          }
        }
      ],
      fieldRoleMap: { text: 'input', gold_label: 'output' },
      reviewerGuidelineText:
        REVIEWER_GUIDELINE_SENTIMENT_BOUNDARY_ZH +
        '（T016）本任務為正式標記三審核員多數決收斂情境，審核門檻為 3 位審核員；' +
        '當三位審核員的判斷出現分歧（如 ofm-05-all-divergent）且未達過半多數時，' +
        '須轉交仲裁員決定，不可逕自收斂。',
      datasetFileName: 'review-flow-official-multi.json',
      datasetRecords: [
        {
          id: 'ofm-01-reviewer-corrects-b',
          text: '從前菜到甜點每一道都很用心，擺盤精緻、味道也無可挑剔，值得專程前往。',
          gold_label: 'positive'
        },
        {
          id: 'ofm-02-approved-interim',
          text: '訂位系統顯示訂位成功，到現場卻說沒有紀錄，白跑一趟非常生氣。',
          gold_label: 'negative'
        },
        {
          id: 'ofm-03-modified-interim',
          text: '湯頭喝得出有熬過，但配料普通，加點的滷味倒是出乎意料地好。',
          gold_label: 'neutral'
        },
        {
          id: 'ofm-04-majority-converged',
          text: '平日中午人不多用餐很安靜，餐點水準就是一般商業午餐的等級。',
          gold_label: 'neutral'
        },
        {
          id: 'ofm-05-all-divergent',
          text: '餐點好吃但服務很糟，價格又偏貴，實在說不上推不推薦。',
          gold_label: 'neutral'
        }
      ]
    },

    T017: {
      taskCategories: ['classification'],
      taskInputTypes: ['single_item'],
      reviewerIds: ['user_mandy', 'user_kevin', 'user_rachel'],
      arbiterIds: ['user_mandy'],
      outputs: [
        {
          type: 'single_label',
          config: {
            label_options: [
              { name: 'positive', color: '#10B981' },
              { name: 'neutral', color: '#F59E0B' },
              { name: 'negative', color: '#EC4899' }
            ]
          }
        }
      ],
      fieldRoleMap: { text: 'input', gold_label: 'output' },
      reviewerGuidelineText:
        REVIEWER_GUIDELINE_SENTIMENT_BOUNDARY_ZH +
        '（T017）本任務為正式標記兩審核員情境，審核門檻為 2 位審核員；' +
        '兩位審核員意見不一致時（如 oft-01-final-exception）屬平手情況，依 ' +
        'per-item-strict-majority 規則不會自動收斂，須轉交仲裁員決定最終結果。',
      datasetFileName: 'review-flow-official-tie.json',
      datasetRecords: [
        {
          id: 'oft-01-final-exception',
          text: '餐廳景觀一流，可以看到整片河岸夜景，但餐點的表現撐不起這個價位。',
          gold_label: 'neutral'
        },
        {
          id: 'oft-02-approved-interim',
          text: '兒童友善空間規劃得很好，餐具和座椅都有替小朋友準備，家庭聚餐首選。',
          gold_label: 'positive'
        },
        {
          id: 'oft-03-modified-interim',
          text: '咖哩飯口味偏甜，附餐的沙拉倒是很新鮮，喜不喜歡見仁見智。',
          gold_label: 'neutral'
        },
        {
          id: 'oft-04-unanimous-gold',
          text: '壽司的新鮮度沒話說，師傅還會依季節推薦食材，每次來都很滿意。',
          gold_label: 'positive'
        },
        {
          id: 'oft-05-pending-review',
          text: '新開的早午餐店，鬆餅口感紮實，佐餐咖啡的比例也調得剛剛好。',
          gold_label: 'positive'
        }
      ]
    }
  };

  /* Guideline & Files (spec 015 v2.0.0 AC-5.1-5.3, 區塊 C): every
   * TaskProfile carries a generic, task-agnostic file list -- the
   * annotation workspace's right-column panel renders these purely by
   * `type` (pdf/image/markdown), never by task_id or task category
   * (Generalization-First; annotation-015 spec's TaskProfile entity
   * explicitly forbids per-task-type hardcoded file lists here). One
   * shared demo file set covers all 17 seed profiles.
   *
   * issue #185: the image entry used to be VA_emj.png (a valence/arousal
   * emotion-scale image), which reads as task-specific and misleads
   * annotators on the other 16 non-VA profiles; it is now a generic
   * placeholder explicitly labeled "通用範例圖" (generic example) instead
   * of fabricating per-category example images, which would need either
   * 13 bespoke assets or per-task-type branching that the entity above
   * disallows. The PDF entry issue #185 removed was a dead link into a
   * nonexistent assets/guidelines/; issue #353 reinstates a PDF entry
   * backed by a real committed asset so the in-page PDF preview modal
   * (spec 015 AC-5.3) is demonstrable. Kept last so tests clicking the
   * first file item keep hitting the image entry. */
  var DEFAULT_GUIDELINE_FILES = [
    {
      name: '通用範例圖.svg',
      type: 'image',
      url: '../../assets/images/task-management/generic-guideline-example.svg'
    },
    {
      name: '常見問題.md',
      type: 'markdown',
      content: '# 常見問題\n\n- **Q: 如何開始標記？** 依左側清單逐筆完成標記，完成後點擊提交。\n- **Q: 不確定答案怎麼辦？** 可於備註欄說明特殊情況，交由 Reviewer 複核。'
    },
    {
      name: '標記指引範例.pdf',
      type: 'pdf',
      url: '../../assets/guidelines/annotation-guideline-sample.pdf'
    }
  ];
  Object.keys(profiles).forEach(function (taskId) {
    profiles[taskId].guidelineFiles = DEFAULT_GUIDELINE_FILES;
  });

  /* Wizard-created tasks (issue #285): merge the same localStorage bucket
   * task-list.data.js reads, so resetTaskData() (task-detail.html:4303)
   * can resolve a profile for the id task-new.html just created instead of
   * falling into TASK_NOT_FOUND. Key is mirrored from task-new.html's
   * CREATED_TASKS_KEY / task-list.data.js's loadCreatedTasks() (cross-file
   * constant convention already used for DRY_RUN_PROGRESS_KEY). */
  var CREATED_TASKS_KEY = 'labelsuite.createdTasks';

  function loadCreatedTasks() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(CREATED_TASKS_KEY) : null;
      var created = raw ? JSON.parse(raw) : [];
      return Array.isArray(created) ? created : [];
    } catch (e) {
      return [];
    }
  }

  loadCreatedTasks().forEach(function (created) {
    profiles[created.id] = {
      taskCategories: created.taskCategories || [],
      taskInputTypes: created.taskInputTypes || [],
      outputs: created.outputs || [],
      fieldRoleMap: created.fieldRoleMap || {},
      datasetFileName: created.datasetFileName || '',
      datasetRecords: created.datasetRecords || [],
      guidelineFiles: DEFAULT_GUIDELINE_FILES
    };
  });

  /* 014 規格常數（issue #596, single-owner review relay, spec v3.0.0）。
   * 與 015 `annotation-workspace.data.js` 的同名/同源常數保持同值，避免
   * 014／015 兩端各自硬編一份不同步的清單（Generalization-First）。
   */

  /* AR_REVIEW_STATUS -- 三態，與 015 REVIEW_UNIT_STATUS 同值同形狀
   * （annotation-workspace.data.js `var REVIEW_UNIT_STATUS = { PENDING,
   * DISPUTED, FINALIZED }`）。舊五態（pending/approved/modified/disputed/
   * finalized）已隨審核員數門檻一併移除；approved/modified 兩個「已審但
   * 未達門檻」的中繼態在恆一位審核員的模型下不可能推導出來。 */
  var AR_REVIEW_STATUS = {
    PENDING: 'pending',
    DISPUTED: 'disputed',
    FINALIZED: 'finalized'
  };

  /* ARBITER_CANDIDATE_RULE -- 仲裁者候選規則。issue #596 新增 canArbitrate
   * 條件：候選集合 = task_role=reviewer AND membership_status=active AND
   * can_arbitrate=true（`can_arbitrate` 之值來自 TaskDetail.arbiter_ids 是
   * 否含該審核員，即 FR-010s-1 的「仲裁者」勾選結果）；另受 015 FR-060 之
   * 非當事人條件約束（未於此重複定義）。 */
  var ARBITER_CANDIDATE_RULE = {
    taskRole: 'reviewer',
    membershipStatus: 'active',
    canArbitrate: true
  };

  /* OVERVIEW_EDITABLE_FIELDS -- Overview 可編輯欄位集合。v3.0.0 移除審核員
   * 數門檻、指派方式、一致即定案開關、第三人仲裁開關四個舊欄位，改列
   * reviewer_ids（新增）；arbiter_ids 沿用既有欄位。 */
  var OVERVIEW_EDITABLE_FIELDS = [
    'task_name',
    'task_type',
    'dataset',
    'field_role_map',
    'outputs[].config',
    'sampling_value',
    'target_agreement_overrides',
    'min_annotators',
    'isolation_enabled',
    'reviewer_ids',
    'arbiter_ids',
    'annotator_guideline_text',
    'annotator_guideline_assets',
    'reviewer_guideline_text',
    'reviewer_guideline_assets',
    'force_guideline'
  ];

  /* EXCEPTION_POOL_ACTIONS -- 與 015 annotation-workspace.data.js 之
   * `EXCEPTION_POOL_ACTIONS` 同值（custom_answer 僅 official_run 提供，見
   * 015 FR-095；本檔不重複該分流邏輯，僅同步集合本身供 014 端的最終例外
   * 池清單／結案閘門判定使用，見 FR-018／FR-008b）。 */
  var EXCEPTION_POOL_ACTIONS = ['adopt_annotator', 'adopt_reviewer', 'custom_answer', 'exclude_from_dataset'];

  /* FR-018 (issue #688, design.md D6): the final exception pool draws its
   * rows live from 015 annotation-workspace's already-existing dispute /
   * arbitration primitives instead of a second, 014-only seed of the same
   * data (Generalization-First / DRY) -- a review unit's disputed item is a
   * pending exception when its arbitration outcome is `reject`
   * (window.LabelSuiteAnnotationWorkspaceData.ARBITRATION_OUTCOMES) and it
   * has not yet been resolved via EXCEPTION_POOL_ACTIONS
   * (getExceptionPool()). Mirrors annotation-workspace.config.js's
   * exceptionPoolQueue(), generalized from one open sample to every review
   * unit of a task+run_type (FR-018 point 5: dry_run/official_run counted
   * independently). Returns [] when the 015 data module or this task's
   * profile is unavailable, rather than throwing -- annotation-workspace.data.js
   * is a same-page script dependency (task-detail.html loads it before this
   * file's caller runs), not a build-time import. */
  function getFinalExceptionPoolItems(taskId, runType) {
    var wsData = global.LabelSuiteAnnotationWorkspaceData;
    var profile = profiles[taskId];
    if (!wsData || !profile) return [];
    var outKeys = (profile.outputs || []).map(function (o) { return o.type; });
    var items = [];
    wsData.listReviewUnits(taskId, runType).forEach(function (unit) {
      if (unit.status !== wsData.REVIEW_UNIT_STATUS.DISPUTED) return;
      var identity = { annotatorId: unit.annotatorId };
      var pool = wsData.getExceptionPool(taskId, runType, unit.sampleId, identity);
      var arbState = wsData.getArbitrationState(taskId, runType, unit.sampleId, identity);
      var disputeItems = wsData.getDisputeItems(taskId, runType, unit.sampleId, identity, outKeys);
      var reviewerIds = wsData.readReviewerSubmissions(taskId, runType, unit.sampleId, identity)
        .map(function (submission) { return submission.reviewerId; });
      disputeItems.forEach(function (item) {
        var itemId = item.outKey + '::' + item.key;
        var stored = arbState[itemId];
        /* design.md D2's sentinel: a `reject` vote never writes finalized_by
           (submitArbitration only sets it for adopt_a/adopt_b), so "stored
           but no finalized_by" IS "arbitrated reject, still open" -- the same
           condition exceptionPoolQueue() checks. */
        if (!stored || stored.finalized_by || pool[item.outKey]) return;
        var rejectVote = (stored.votes || []).filter(function (v) { return v.choice === 'reject'; }).pop();
        items.push({
          taskId: taskId,
          runType: runType,
          sampleId: unit.sampleId,
          annotatorId: unit.annotatorId,
          reviewerIds: reviewerIds,
          outputType: item.outKey,
          arbiterId: rejectVote ? rejectVote.arbiter_id : '',
          reason: rejectVote ? (rejectVote.reason || '') : '',
          fellAt: rejectVote ? rejectVote.voted_at : ''
        });
      });
    });
    return items;
  }

  /* FR-008b (issue #688): task-completion blocker list. `context` carries
   * pre-computed signals from the caller (task-detail.html), which already
   * owns TASK_DATA/ANNOTATION_PROGRESS/the exception-pool query above --
   * this function stays a pure reducer over booleans/counts so it needs no
   * DOM or global state of its own.
   *
   * Scope note: this prototype iteration wires only condition 4 (final
   * exception pool, official_run only, FR-018) as a live gate. Conditions
   * 1/2/3/5 (submission complete, review units finalized, no disputed unit,
   * quality metrics ready) have no live-state derivation in 014 today --
   * ANNOTATION_PROGRESS and REVIEW_WORKLOAD are decorative demo seeds never
   * derived from the actual publish click flow (unlike the exception pool,
   * which reads 015's real dispute/arbitration state), so gating on them
   * would block completion for reasons unrelated to a given task's actual
   * state. This function still accepts all five signals so a future change
   * can wire the rest without changing its shape; each condition defaults
   * to "satisfied" when the caller omits it, matching task-detail.html's
   * current caller, which only computes exceptionPoolPendingCount. */
  function getTaskCompletionBlockers(context) {
    context = context || {};
    var blockers = [];
    if (!context.submissionComplete) blockers.push({ code: 'submission_incomplete' });
    if (context.reviewFinalized === false) blockers.push({ code: 'review_pending' });
    if (context.noDisputedUnits === false) blockers.push({ code: 'disputed_units' });
    if ((context.exceptionPoolPendingCount || 0) > 0) {
      blockers.push({ code: 'exception_pool_pending', count: context.exceptionPoolPendingCount });
    }
    if (context.qualityMetricsReady === false) blockers.push({ code: 'quality_metrics_not_ready' });
    return blockers;
  }

  global.LabelSuiteTaskDetailData = {
    profiles: profiles,
    AR_REVIEW_STATUS: AR_REVIEW_STATUS,
    ARBITER_CANDIDATE_RULE: ARBITER_CANDIDATE_RULE,
    OVERVIEW_EDITABLE_FIELDS: OVERVIEW_EDITABLE_FIELDS,
    EXCEPTION_POOL_ACTIONS: EXCEPTION_POOL_ACTIONS,
    getFinalExceptionPoolItems: getFinalExceptionPoolItems,
    getTaskCompletionBlockers: getTaskCompletionBlockers
  };
}(window));
