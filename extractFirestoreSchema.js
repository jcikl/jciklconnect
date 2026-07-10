const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 初始化 Firebase Admin SDK
// 确保你有 serviceAccountKey.json 在项目根目录
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/**
 * 检测数据类型
 */
function getDataType(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'float';
  }
  if (typeof value === 'boolean') return 'boolean';
  if (value instanceof Date) return 'timestamp';
  if (value instanceof admin.firestore.Timestamp) return 'timestamp';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') {
    if (value instanceof admin.firestore.GeoPoint) return 'geopoint';
    if (value instanceof admin.firestore.DocumentReference) return 'reference';
    return 'object';
  }
  return 'unknown';
}

/**
 * 扫描单个 Collection，提取所有字段和类型
 */
async function scanCollection(collectionName, maxDocuments = 10) {
  try {
    console.log(`\n📂 正在扫描 Collection: ${collectionName}`);
    
    const snapshot = await db.collection(collectionName).limit(maxDocuments).get();
    
    if (snapshot.empty) {
      console.log(`  ⚠️  ${collectionName} 是空的`);
      return {
        name: collectionName,
        docCount: 0,
        fields: {},
        subcollections: [],
      };
    }

    const fieldsMap = {};
    const subcollectionsSet = new Set();

    // 遍历文档，提取字段
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // 扫描直接字段
      Object.entries(data).forEach(([fieldName, value]) => {
        if (!fieldsMap[fieldName]) {
          fieldsMap[fieldName] = {
            types: new Set(),
            examples: [],
          };
        }
        
        const dataType = getDataType(value);
        fieldsMap[fieldName].types.add(dataType);
        
        // 保存示例值（非敏感数据）
        if (fieldsMap[fieldName].examples.length < 2) {
          if (typeof value !== 'object' || value instanceof Date) {
            fieldsMap[fieldName].examples.push(value);
          }
        }
      });

      // 扫描 subcollections
      const subCollections = await doc.ref.listCollections();
      subCollections.forEach(subCol => {
        subcollectionsSet.add(subCol.id);
      });
    }

    // 格式化字段信息
    const formattedFields = {};
    Object.entries(fieldsMap).forEach(([fieldName, info]) => {
      formattedFields[fieldName] = {
        types: Array.from(info.types),
        examples: info.examples.slice(0, 1), // 只保留 1 个示例
      };
    });

    // 获取文档总数
    const totalDocs = (await db.collection(collectionName).count().get()).data().count;

    return {
      name: collectionName,
      docCount: totalDocs,
      fields: formattedFields,
      subcollections: Array.from(subcollectionsSet),
    };
  } catch (error) {
    console.error(`❌ 扫描 ${collectionName} 失败:`, error.message);
    return null;
  }
}

/**
 * 主函数：扫描所有 Collection
 */
async function extractFirestoreSchema() {
  try {
    console.log('🚀 开始扫描 Firestore 数据库结构...\n');

    // 获取所有顶级 Collections
    const collectionsSnapshot = await db.listCollections();
    const collectionNames = collectionsSnapshot.map(col => col.id);

    console.log(`📊 找到 ${collectionNames.length} 个 Collections: ${collectionNames.join(', ')}\n`);

    // 扫描每个 Collection
    const schema = {
      timestamp: new Date().toISOString(),
      totalCollections: collectionNames.length,
      collections: [],
    };

    for (const collectionName of collectionNames) {
      const collectionSchema = await scanCollection(collectionName);
      if (collectionSchema) {
        schema.collections.push(collectionSchema);
      }
    }

    // 保存为 JSON 文件
    const outputPath = path.join(__dirname, 'firestore-schema.json');
    fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2), 'utf-8');

    console.log(`\n✅ 完成！Schema 已保存到: ${outputPath}`);
    console.log(`\n📋 摘要:`);
    schema.collections.forEach(col => {
      console.log(`  • ${col.name}: ${col.docCount} 文档, ${Object.keys(col.fields).length} 字段`);
    });

    return schema;
  } catch (error) {
    console.error('❌ 发生错误:', error);
  } finally {
    process.exit(0);
  }
}

// 运行脚本
extractFirestoreSchema();