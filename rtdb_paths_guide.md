# AgriTwin RTDB 路径指南（给硬件队友）

## 当前数据来源

**现在全部是 Python Simulator 模拟生成**，通过 `backend/database.py` 的 `_background_cloud_sync()` 写入 Firebase RTDB。前端直接从 RTDB 实时读取显示。

硬件就绪后，硬件端（ESP32/Arduino）直接往同样的 RTDB 路径写数据即可，前端不需要改任何代码。

---

## RTDB 完整路径列表

### Base Path

```
users/{uid}/live/latest/
```

> `{uid}` = 登录用户的 Firebase Auth UID（例如 `ZLwjf4x1vBPkcEHc015OhelwwHo1`）

---

### 所有 Sensor Key 及其数据结构

硬件需要 **update** 以下 12 个 key 到 `users/{uid}/live/latest/` 路径下：

#### Greenhouse Condition（温室空气环境）

| RTDB Key | 传感器 | 单位 | 典型范围 |
|----------|--------|------|----------|
| `zone_air:temperature` | 空气温度 | °C | 10 ~ 45 |
| `zone_air:humidity` | 空气湿度 | % | 20 ~ 99 |
| `zone_air:light_intensity` | 光照强度 | lux | 0 ~ 100000 |

#### Substrate Bed A（基质床 A）

| RTDB Key | 传感器 | 单位 | 典型范围 |
|----------|--------|------|----------|
| `zone_bed_a:soil_temperature` | 土壤温度 | °C | 10 ~ 40 |
| `zone_bed_a:soil_ph` | 土壤 pH 值 | pH | 4.0 ~ 9.0 |
| `zone_bed_a:soil_moisture` | 土壤湿度 | % | 10 ~ 90 |

#### Substrate Bed B（基质床 B）

| RTDB Key | 传感器 | 单位 | 典型范围 |
|----------|--------|------|----------|
| `zone_bed_b:soil_temperature` | 土壤温度 | °C | 10 ~ 40 |
| `zone_bed_b:soil_ph` | 土壤 pH 值 | pH | 4.0 ~ 9.0 |
| `zone_bed_b:soil_moisture` | 土壤湿度 | % | 10 ~ 90 |

#### Substrate Bed C（基质床 C）

| RTDB Key | 传感器 | 单位 | 典型范围 |
|----------|--------|------|----------|
| `zone_bed_c:soil_temperature` | 土壤温度 | °C | 10 ~ 40 |
| `zone_bed_c:soil_ph` | 土壤 pH 值 | pH | 4.0 ~ 9.0 |
| `zone_bed_c:soil_moisture` | 土壤湿度 | % | 10 ~ 90 |

---

### 每个 Key 的 JSON 数据格式

硬件写入时，每个 key 的值必须是以下结构的 JSON object：

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
| `sensor_id` | string | 传感器唯一标识，自定义即可 |
| `sensor_type` | string | **必须**和 key 的冒号后半部分一致（如 `soil_temperature`） |
| `zone_id` | string | **必须**和 key 的冒号前半部分一致（如 `zone_bed_a`） |
| `value` | number | 传感器读数 |
| `unit` | string | 单位（`°C`, `%`, `lux`, `pH`） |
| `timestamp` | string | ISO 8601 格式，带时区（UTC+8） |
| `quality` | number | 数据质量 0.0~1.0，正常传 `1.0`，传感器异常传低值 |

---

### Arduino/ESP32 写入示例

```cpp
// Firebase ESP32 Client Library
String basePath = "users/" + uid + "/live/latest/";

// 写入空气温度
FirebaseJson json;
json.set("sensor_id", "air_temp_1");
json.set("sensor_type", "temperature");
json.set("zone_id", "zone_air");
json.set("value", 28.5);
json.set("unit", "°C");
json.set("timestamp", getISO8601Time());
json.set("quality", 1.0);

Firebase.RTDB.updateNode(&fbdo, basePath + "zone_air:temperature", &json);
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
            ├── latest/                          ← 前端实时读取这里
            │   ├── zone_air:temperature         ← { value, unit, quality, ... }
            │   ├── zone_air:humidity
            │   ├── zone_air:light_intensity
            │   ├── zone_bed_a:soil_temperature
            │   ├── zone_bed_a:soil_ph
            │   ├── zone_bed_a:soil_moisture
            │   ├── zone_bed_b:soil_temperature
            │   ├── zone_bed_b:soil_ph
            │   ├── zone_bed_b:soil_moisture
            │   ├── zone_bed_c:soil_temperature
            │   ├── zone_bed_c:soil_ph
            │   └── zone_bed_c:soil_moisture
            └── history/                         ← 后端写入历史（图表用）
                ├── zone_air/
                │   ├── temperature/
                │   ├── humidity/
                │   └── light_intensity/
                ├── zone_bed_a/
                │   ├── soil_temperature/
                │   ├── soil_ph/
                │   └── soil_moisture/
                ├── zone_bed_b/
                │   └── ...
                └── zone_bed_c/
                    └── ...
```

> [!IMPORTANT]
> 硬件只需要写 `latest/` 路径。`history/` 由后端 `database.py` 自动从 latest 复制过去（如果后端在跑的话）。如果后端不跑，前端图表将没有历史数据，但实时数值卡片正常。
