# AgriTwin RTDB 路径指南（给硬件队友）

## 当前数据来源

**现在全部是 Python Simulator 模拟生成**，通过 `backend/database.py` 的 `_background_cloud_sync()` 写入 Firebase RTDB。前端直接从 RTDB 实时读取显示。

硬件就绪后，硬件端（ESP32/Arduino）直接往同样的 RTDB 路径写数据即可，前端不需要改任何代码。

---

## RTDB 完整路径列表

### Base Path

```
users/{uid}/live/
```

> `{uid}` = 登录用户的 Firebase Auth UID（例如 `ZLwjf4x1vBPkcEHc015OhelwwHo1`）

---

### Latest（实时数据）

路径：`users/{uid}/live/latest/`

硬件需要 **update** 以下 13 个 key：

#### Greenhouse Condition（温室空气环境）

| # | RTDB Key | sensor_id | sensor_type | 传感器 | 单位 | 典型范围 |
|---|----------|-----------|-------------|--------|------|----------|
| 1 | `zone_air:air_rh_1` | `air_rh_1` | `humidity` | 空气湿度传感器 1 | % | 20 ~ 99 |
| 2 | `zone_air:air_rh_2` | `air_rh_2` | `humidity` | 空气湿度传感器 2 | % | 20 ~ 99 |
| 3 | `zone_air:air_temp_1` | `air_temp_1` | `temperature` | 空气温度传感器 | °C | 10 ~ 45 |
| 4 | `zone_air:air_light_1` | `air_light_1` | `light_intensity` | 光照传感器 | lux | 0 ~ 100000 |

#### Substrate Bed A（基质床 A）

| # | RTDB Key | sensor_id | sensor_type | 传感器 | 单位 | 典型范围 |
|---|----------|-----------|-------------|--------|------|----------|
| 5 | `zone_bed_a:bed_a_temp` | `bed_a_temp` | `soil_temperature` | 土壤温度 | °C | 10 ~ 40 |
| 6 | `zone_bed_a:bed_a_ph` | `bed_a_ph` | `soil_ph` | 土壤 pH | pH | 4.0 ~ 9.0 |
| 7 | `zone_bed_a:bed_a_moisture` | `bed_a_moisture` | `soil_moisture` | 土壤湿度 | % | 10 ~ 90 |

#### Substrate Bed B（基质床 B）

| # | RTDB Key | sensor_id | sensor_type | 传感器 | 单位 | 典型范围 |
|---|----------|-----------|-------------|--------|------|----------|
| 8 | `zone_bed_b:bed_b_temp` | `bed_b_temp` | `soil_temperature` | 土壤温度 | °C | 10 ~ 40 |
| 9 | `zone_bed_b:bed_b_ph` | `bed_b_ph` | `soil_ph` | 土壤 pH | pH | 4.0 ~ 9.0 |
| 10 | `zone_bed_b:bed_b_moisture` | `bed_b_moisture` | `soil_moisture` | 土壤湿度 | % | 10 ~ 90 |

#### Substrate Bed C（基质床 C）

| # | RTDB Key | sensor_id | sensor_type | 传感器 | 单位 | 典型范围 |
|---|----------|-----------|-------------|--------|------|----------|
| 11 | `zone_bed_c:bed_c_temp` | `bed_c_temp` | `soil_temperature` | 土壤温度 | °C | 10 ~ 40 |
| 12 | `zone_bed_c:bed_c_ph` | `bed_c_ph` | `soil_ph` | 土壤 pH | pH | 4.0 ~ 9.0 |
| 13 | `zone_bed_c:bed_c_moisture` | `bed_c_moisture` | `soil_moisture` | 土壤湿度 | % | 10 ~ 90 |

---

### History（历史数据，图表用）

路径：`users/{uid}/live/history/{zone_id}/{sensor_id}/`

每次写入 latest 时，**同时 push 一条到 history**，前端图表才有数据。

| # | History 路径 | 说明 |
|---|-------------|------|
| 1 | `history/zone_air/air_rh_1/` | 湿度传感器 1 历史 |
| 2 | `history/zone_air/air_rh_2/` | 湿度传感器 2 历史 |
| 3 | `history/zone_air/air_temp_1/` | 温度传感器历史 |
| 4 | `history/zone_air/air_light_1/` | 光照传感器历史 |
| 5 | `history/zone_bed_a/bed_a_temp/` | Bed A 温度历史 |
| 6 | `history/zone_bed_a/bed_a_ph/` | Bed A pH 历史 |
| 7 | `history/zone_bed_a/bed_a_moisture/` | Bed A 湿度历史 |
| 8 | `history/zone_bed_b/bed_b_temp/` | Bed B 温度历史 |
| 9 | `history/zone_bed_b/bed_b_ph/` | Bed B pH 历史 |
| 10 | `history/zone_bed_b/bed_b_moisture/` | Bed B 湿度历史 |
| 11 | `history/zone_bed_c/bed_c_temp/` | Bed C 温度历史 |
| 12 | `history/zone_bed_c/bed_c_ph/` | Bed C pH 历史 |
| 13 | `history/zone_bed_c/bed_c_moisture/` | Bed C 湿度历史 |

> History 下每条记录用 `push()` 写入（自动生成唯一 key），格式跟 latest 的 JSON 一样。

---

### 每个 Key 的 JSON 数据格式

Latest 和 History 用**同一个格式**：

```json
{
  "sensor_id": "bed_a_temp",
  "sensor_type": "soil_temperature",
  "zone_id": "zone_bed_a",
  "value": 22.3,
  "unit": "°C",
  "timestamp": "2026-04-15T11:00:00+08:00",
  "quality": 1.0
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `sensor_id` | string | 传感器 ID，**必须跟表格里的 sensor_id 一致** |
| `sensor_type` | string | 传感器类型，**必须跟表格里的 sensor_type 一致** |
| `zone_id` | string | 区域 ID，**必须跟 RTDB key 冒号前面的部分一致** |
| `value` | number | 传感器读数 |
| `unit` | string | 单位（`°C`, `%`, `lux`, `pH`） |
| `timestamp` | string | ISO 8601 格式，带时区（UTC+8） |
| `quality` | number | 数据质量 0.0~1.0，正常传 `1.0`，异常传低值 |

---

### Arduino/ESP32 写入示例

```cpp
// Firebase ESP32 Client Library
String uid = "ZLwjf4x1vBPkcEHc015OhelwwHo1";
String basePath = "users/" + uid + "/live/";

// ── 写入 latest（实时值）──
FirebaseJson json;
json.set("sensor_id", "air_temp_1");
json.set("sensor_type", "temperature");
json.set("zone_id", "zone_air");
json.set("value", 28.5);
json.set("unit", "°C");
json.set("timestamp", getISO8601Time());
json.set("quality", 1.0);

Firebase.RTDB.updateNode(&fbdo, basePath + "latest/zone_air:air_temp_1", &json);

// ── 同时 push 到 history（图表数据）──
Firebase.RTDB.pushJSON(&fbdo, basePath + "history/zone_air/air_temp_1", &json);
```

---

## 硬件就绪后需要改什么

### 方案 1：最简单 — 只改后端（推荐）

只需要在 `backend/config.py` 里关掉 simulator：

```python
simulator_enabled = False  # 改为 False
```

然后硬件直接写 RTDB，前端自动读取，**零代码修改**。

### 方案 2：并行模式（测试用）

Simulator 继续跑，但硬件的写入会覆盖 RTDB 里的值。前端读到的永远是**最后一次写入的值**（谁后写谁覆盖）。不建议长期使用。

---

## RTDB 路径结构树状图

```
agritwin-mrv-default-rtdb.firebaseio.com/
└── users/
    └── {uid}/
        └── live/
            ├── latest/                              ← 前端实时读取
            │   ├── zone_air:air_rh_1               ← { sensor_id, sensor_type, value, unit, timestamp, quality }
            │   ├── zone_air:air_rh_2
            │   ├── zone_air:air_temp_1
            │   ├── zone_air:air_light_1
            │   ├── zone_bed_a:bed_a_temp
            │   ├── zone_bed_a:bed_a_ph
            │   ├── zone_bed_a:bed_a_moisture
            │   ├── zone_bed_b:bed_b_temp
            │   ├── zone_bed_b:bed_b_ph
            │   ├── zone_bed_b:bed_b_moisture
            │   ├── zone_bed_c:bed_c_temp
            │   ├── zone_bed_c:bed_c_ph
            │   └── zone_bed_c:bed_c_moisture
            └── history/                             ← 前端图表读取
                ├── zone_air/
                │   ├── air_rh_1/{push_key}: {...}
                │   ├── air_rh_2/{push_key}: {...}
                │   ├── air_temp_1/{push_key}: {...}
                │   └── air_light_1/{push_key}: {...}
                ├── zone_bed_a/
                │   ├── bed_a_temp/{push_key}: {...}
                │   ├── bed_a_ph/{push_key}: {...}
                │   └── bed_a_moisture/{push_key}: {...}
                ├── zone_bed_b/
                │   ├── bed_b_temp/{push_key}: {...}
                │   ├── bed_b_ph/{push_key}: {...}
                │   └── bed_b_moisture/{push_key}: {...}
                └── zone_bed_c/
                    ├── bed_c_temp/{push_key}: {...}
                    ├── bed_c_ph/{push_key}: {...}
                    └── bed_c_moisture/{push_key}: {...}
```

> **Key 格式规则**：RTDB key 统一用 `{zone_id}:{sensor_id}`，History 路径用 `{zone_id}/{sensor_id}/`。
