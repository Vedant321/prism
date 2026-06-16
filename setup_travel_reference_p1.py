"""
Part 1: Create schema + city_distance_matrix + uber_intracity_estimates
"""
import os, requests, time
from dotenv import load_dotenv

load_dotenv('/Users/tek32386/databricks_hackathon/.env')
host  = os.getenv('host').rstrip('/')
token = os.getenv('password')
warehouse_id = 'f8d3057b2ca4a784'
headers = {'Authorization': f'Bearer {token}'}

def run_sql(sql, label=''):
    payload = {
        'statement': sql,
        'warehouse_id': warehouse_id,
        'wait_timeout': '50s',
        'on_wait_timeout': 'CANCEL'
    }
    r = requests.post(f'{host}/api/2.0/sql/statements', headers=headers, json=payload)
    d = r.json()
    sid = d.get('statement_id')
    while d.get('status',{}).get('state') in ('PENDING','RUNNING') and sid:
        time.sleep(2)
        d = requests.get(f'{host}/api/2.0/sql/statements/{sid}', headers=headers).json()
    state = d.get('status',{}).get('state','')
    if state == 'SUCCEEDED':
        if 'manifest' in d and d['manifest'].get('schema',{}).get('columns'):
            cols = [c['name'] for c in d['manifest']['schema']['columns']]
            rows = d.get('result',{}).get('data_array', [])
        else:
            cols, rows = [], []
        if label:
            print(f"  OK [{label}]: {len(rows)} rows")
        return cols, rows
    err = d.get('status',{}).get('error',{}).get('message','unknown')
    print(f"  ERR [{label}]: {err}")
    raise Exception(err)

# ── Schema ────────────────────────────────────────────────────────────────────
print("Creating schema...")
run_sql("CREATE SCHEMA IF NOT EXISTS hackathon_workspace.travel_reference COMMENT 'Reference tables for the Referral Copilot travel estimation feature'", "schema")

# ── TABLE 1: city_distance_matrix ─────────────────────────────────────────────
print("Creating city_distance_matrix...")
run_sql("""
CREATE OR REPLACE TABLE hackathon_workspace.travel_reference.city_distance_matrix (
  origin_city       STRING  COMMENT 'Origin city name',
  destination_city  STRING  COMMENT 'Destination city name',
  state_origin      STRING  COMMENT 'State of origin city',
  state_destination STRING  COMMENT 'State of destination city',
  distance_km       DOUBLE  COMMENT 'Approximate road distance in km',
  is_same_state     BOOLEAN COMMENT 'True if both cities are in the same state',
  is_same_city      BOOLEAN COMMENT 'Always false in this table'
) USING DELTA
COMMENT 'Road distance matrix between 30 major Indian cities. Both directions stored as separate rows.'
""", "create city_distance_matrix")

# Road distances (km) — realistic 2024 NH/highway distances
# Format: (origin, dest, state_o, state_d, km)
distances_raw = [
    # Mumbai connections
    ("Mumbai","Delhi","Maharashtra","Delhi",1421),
    ("Mumbai","Bangalore","Maharashtra","Karnataka",984),
    ("Mumbai","Chennai","Maharashtra","Tamil Nadu",1338),
    ("Mumbai","Kolkata","Maharashtra","West Bengal",2054),
    ("Mumbai","Hyderabad","Maharashtra","Telangana",711),
    ("Mumbai","Pune","Maharashtra","Maharashtra",148),
    ("Mumbai","Ahmedabad","Maharashtra","Gujarat",524),
    ("Mumbai","Jaipur","Maharashtra","Rajasthan",1145),
    ("Mumbai","Lucknow","Maharashtra","Uttar Pradesh",1441),
    ("Mumbai","Surat","Maharashtra","Gujarat",280),
    ("Mumbai","Patna","Maharashtra","Bihar",1996),
    ("Mumbai","Bhopal","Maharashtra","Madhya Pradesh",779),
    ("Mumbai","Nagpur","Maharashtra","Maharashtra",872),
    ("Mumbai","Indore","Maharashtra","Madhya Pradesh",589),
    ("Mumbai","Bhubaneswar","Maharashtra","Odisha",1720),
    ("Mumbai","Chandigarh","Maharashtra","Punjab",1667),
    ("Mumbai","Coimbatore","Maharashtra","Tamil Nadu",1172),
    ("Mumbai","Kochi","Maharashtra","Kerala",1210),
    ("Mumbai","Guwahati","Maharashtra","Assam",2570),
    ("Mumbai","Raipur","Maharashtra","Chhattisgarh",1161),
    ("Mumbai","Ranchi","Maharashtra","Jharkhand",1891),
    ("Mumbai","Dehradun","Maharashtra","Uttarakhand",1697),
    ("Mumbai","Amritsar","Maharashtra","Punjab",1901),
    ("Mumbai","Vadodara","Maharashtra","Gujarat",391),
    ("Mumbai","Agra","Maharashtra","Uttar Pradesh",1313),
    ("Mumbai","Varanasi","Maharashtra","Uttar Pradesh",1604),
    ("Mumbai","Thiruvananthapuram","Maharashtra","Kerala",1495),
    ("Mumbai","Mysore","Maharashtra","Karnataka",1063),
    ("Mumbai","Visakhapatnam","Maharashtra","Andhra Pradesh",1266),
    # Delhi connections
    ("Delhi","Bangalore","Delhi","Karnataka",2147),
    ("Delhi","Chennai","Delhi","Tamil Nadu",2176),
    ("Delhi","Kolkata","Delhi","West Bengal",1484),
    ("Delhi","Hyderabad","Delhi","Telangana",1568),
    ("Delhi","Pune","Delhi","Maharashtra",1480),
    ("Delhi","Ahmedabad","Delhi","Gujarat",934),
    ("Delhi","Jaipur","Delhi","Rajasthan",282),
    ("Delhi","Lucknow","Delhi","Uttar Pradesh",555),
    ("Delhi","Surat","Delhi","Gujarat",1130),
    ("Delhi","Patna","Delhi","Bihar",1002),
    ("Delhi","Bhopal","Delhi","Madhya Pradesh",773),
    ("Delhi","Nagpur","Delhi","Maharashtra",1092),
    ("Delhi","Indore","Delhi","Madhya Pradesh",793),
    ("Delhi","Bhubaneswar","Delhi","Odisha",1757),
    ("Delhi","Chandigarh","Delhi","Punjab",260),
    ("Delhi","Coimbatore","Delhi","Tamil Nadu",2358),
    ("Delhi","Kochi","Delhi","Kerala",2645),
    ("Delhi","Guwahati","Delhi","Assam",1961),
    ("Delhi","Raipur","Delhi","Chhattisgarh",1219),
    ("Delhi","Ranchi","Delhi","Jharkhand",1299),
    ("Delhi","Dehradun","Delhi","Uttarakhand",304),
    ("Delhi","Amritsar","Delhi","Punjab",447),
    ("Delhi","Vadodara","Delhi","Gujarat",1006),
    ("Delhi","Agra","Delhi","Uttar Pradesh",231),
    ("Delhi","Varanasi","Delhi","Uttar Pradesh",820),
    ("Delhi","Thiruvananthapuram","Delhi","Kerala",2930),
    ("Delhi","Mysore","Delhi","Karnataka",2257),
    ("Delhi","Visakhapatnam","Delhi","Andhra Pradesh",1829),
    # Bangalore connections
    ("Bangalore","Chennai","Karnataka","Tamil Nadu",346),
    ("Bangalore","Kolkata","Karnataka","West Bengal",1869),
    ("Bangalore","Hyderabad","Karnataka","Telangana",570),
    ("Bangalore","Pune","Karnataka","Maharashtra",838),
    ("Bangalore","Ahmedabad","Karnataka","Gujarat",1448),
    ("Bangalore","Jaipur","Karnataka","Rajasthan",2064),
    ("Bangalore","Lucknow","Karnataka","Uttar Pradesh",1973),
    ("Bangalore","Surat","Karnataka","Gujarat",1249),
    ("Bangalore","Patna","Karnataka","Bihar",2147),
    ("Bangalore","Bhopal","Karnataka","Madhya Pradesh",1320),
    ("Bangalore","Nagpur","Karnataka","Maharashtra",1042),
    ("Bangalore","Indore","Karnataka","Madhya Pradesh",1168),
    ("Bangalore","Bhubaneswar","Karnataka","Odisha",1573),
    ("Bangalore","Chandigarh","Karnataka","Punjab",2374),
    ("Bangalore","Coimbatore","Karnataka","Tamil Nadu",260),
    ("Bangalore","Kochi","Karnataka","Kerala",545),
    ("Bangalore","Guwahati","Karnataka","Assam",2530),
    ("Bangalore","Raipur","Karnataka","Chhattisgarh",1213),
    ("Bangalore","Ranchi","Karnataka","Jharkhand",1824),
    ("Bangalore","Dehradun","Karnataka","Uttarakhand",2386),
    ("Bangalore","Amritsar","Karnataka","Punjab",2640),
    ("Bangalore","Vadodara","Karnataka","Gujarat",1254),
    ("Bangalore","Agra","Karnataka","Uttar Pradesh",2118),
    ("Bangalore","Varanasi","Karnataka","Uttar Pradesh",1884),
    ("Bangalore","Thiruvananthapuram","Karnataka","Kerala",672),
    ("Bangalore","Mysore","Karnataka","Karnataka",145),
    ("Bangalore","Visakhapatnam","Karnataka","Andhra Pradesh",881),
    # Chennai connections
    ("Chennai","Kolkata","Tamil Nadu","West Bengal",1659),
    ("Chennai","Hyderabad","Tamil Nadu","Telangana",626),
    ("Chennai","Pune","Tamil Nadu","Maharashtra",1188),
    ("Chennai","Ahmedabad","Tamil Nadu","Gujarat",1955),
    ("Chennai","Jaipur","Tamil Nadu","Rajasthan",2402),
    ("Chennai","Lucknow","Tamil Nadu","Uttar Pradesh",2282),
    ("Chennai","Patna","Tamil Nadu","Bihar",2346),
    ("Chennai","Bhopal","Tamil Nadu","Madhya Pradesh",1622),
    ("Chennai","Nagpur","Tamil Nadu","Maharashtra",1107),
    ("Chennai","Indore","Tamil Nadu","Madhya Pradesh",1567),
    ("Chennai","Bhubaneswar","Tamil Nadu","Odisha",1345),
    ("Chennai","Chandigarh","Tamil Nadu","Punjab",2711),
    ("Chennai","Coimbatore","Tamil Nadu","Tamil Nadu",497),
    ("Chennai","Kochi","Tamil Nadu","Kerala",681),
    ("Chennai","Guwahati","Tamil Nadu","Assam",2431),
    ("Chennai","Raipur","Tamil Nadu","Chhattisgarh",1345),
    ("Chennai","Ranchi","Tamil Nadu","Jharkhand",1812),
    ("Chennai","Dehradun","Tamil Nadu","Uttarakhand",2647),
    ("Chennai","Amritsar","Tamil Nadu","Punjab",2942),
    ("Chennai","Vadodara","Tamil Nadu","Gujarat",1739),
    ("Chennai","Agra","Tamil Nadu","Uttar Pradesh",2299),
    ("Chennai","Varanasi","Tamil Nadu","Uttar Pradesh",2118),
    ("Chennai","Thiruvananthapuram","Tamil Nadu","Kerala",702),
    ("Chennai","Mysore","Tamil Nadu","Karnataka",472),
    ("Chennai","Visakhapatnam","Tamil Nadu","Andhra Pradesh",793),
    # Kolkata connections
    ("Kolkata","Hyderabad","West Bengal","Telangana",1508),
    ("Kolkata","Pune","West Bengal","Maharashtra",1947),
    ("Kolkata","Ahmedabad","West Bengal","Gujarat",2070),
    ("Kolkata","Jaipur","West Bengal","Rajasthan",1828),
    ("Kolkata","Lucknow","West Bengal","Uttar Pradesh",979),
    ("Kolkata","Patna","West Bengal","Bihar",573),
    ("Kolkata","Bhopal","West Bengal","Madhya Pradesh",1386),
    ("Kolkata","Nagpur","West Bengal","Maharashtra",1121),
    ("Kolkata","Indore","West Bengal","Madhya Pradesh",1656),
    ("Kolkata","Bhubaneswar","West Bengal","Odisha",440),
    ("Kolkata","Chandigarh","West Bengal","Punjab",1729),
    ("Kolkata","Coimbatore","West Bengal","Tamil Nadu",2131),
    ("Kolkata","Kochi","West Bengal","Kerala",2221),
    ("Kolkata","Guwahati","West Bengal","Assam",991),
    ("Kolkata","Raipur","West Bengal","Chhattisgarh",887),
    ("Kolkata","Ranchi","West Bengal","Jharkhand",415),
    ("Kolkata","Dehradun","West Bengal","Uttarakhand",1617),
    ("Kolkata","Amritsar","West Bengal","Punjab",1980),
    ("Kolkata","Vadodara","West Bengal","Gujarat",1883),
    ("Kolkata","Agra","West Bengal","Uttar Pradesh",1287),
    ("Kolkata","Varanasi","West Bengal","Uttar Pradesh",668),
    ("Kolkata","Thiruvananthapuram","West Bengal","Kerala",2535),
    ("Kolkata","Mysore","West Bengal","Karnataka",1989),
    ("Kolkata","Visakhapatnam","West Bengal","Andhra Pradesh",1042),
    # Hyderabad connections
    ("Hyderabad","Pune","Telangana","Maharashtra",564),
    ("Hyderabad","Ahmedabad","Telangana","Gujarat",1110),
    ("Hyderabad","Jaipur","Telangana","Rajasthan",1464),
    ("Hyderabad","Lucknow","Telangana","Uttar Pradesh",1366),
    ("Hyderabad","Patna","Telangana","Bihar",1681),
    ("Hyderabad","Bhopal","Telangana","Madhya Pradesh",767),
    ("Hyderabad","Nagpur","Telangana","Maharashtra",500),
    ("Hyderabad","Indore","Telangana","Madhya Pradesh",820),
    ("Hyderabad","Bhubaneswar","Telangana","Odisha",1087),
    ("Hyderabad","Chandigarh","Telangana","Punjab",1998),
    ("Hyderabad","Coimbatore","Telangana","Tamil Nadu",741),
    ("Hyderabad","Kochi","Telangana","Kerala",1103),
    ("Hyderabad","Guwahati","Telangana","Assam",2199),
    ("Hyderabad","Raipur","Telangana","Chhattisgarh",647),
    ("Hyderabad","Ranchi","Telangana","Jharkhand",1188),
    ("Hyderabad","Dehradun","Telangana","Uttarakhand",1877),
    ("Hyderabad","Amritsar","Telangana","Punjab",2132),
    ("Hyderabad","Vadodara","Telangana","Gujarat",915),
    ("Hyderabad","Agra","Telangana","Uttar Pradesh",1390),
    ("Hyderabad","Varanasi","Telangana","Uttar Pradesh",1245),
    ("Hyderabad","Thiruvananthapuram","Telangana","Kerala",1350),
    ("Hyderabad","Mysore","Telangana","Karnataka",680),
    ("Hyderabad","Visakhapatnam","Telangana","Andhra Pradesh",625),
    # Pune connections
    ("Pune","Ahmedabad","Maharashtra","Gujarat",412),
    ("Pune","Jaipur","Maharashtra","Rajasthan",1096),
    ("Pune","Lucknow","Maharashtra","Uttar Pradesh",1395),
    ("Pune","Patna","Maharashtra","Bihar",1861),
    ("Pune","Bhopal","Maharashtra","Madhya Pradesh",662),
    ("Pune","Nagpur","Maharashtra","Maharashtra",724),
    ("Pune","Indore","Maharashtra","Madhya Pradesh",476),
    ("Pune","Bhubaneswar","Maharashtra","Odisha",1572),
    ("Pune","Chandigarh","Maharashtra","Punjab",1734),
    ("Pune","Coimbatore","Maharashtra","Tamil Nadu",1026),
    ("Pune","Kochi","Maharashtra","Kerala",1101),
    ("Pune","Guwahati","Maharashtra","Assam",2418),
    ("Pune","Raipur","Maharashtra","Chhattisgarh",1015),
    ("Pune","Ranchi","Maharashtra","Jharkhand",1743),
    ("Pune","Dehradun","Maharashtra","Uttarakhand",1760),
    ("Pune","Amritsar","Maharashtra","Punjab",1985),
    ("Pune","Vadodara","Maharashtra","Gujarat",279),
    ("Pune","Agra","Maharashtra","Uttar Pradesh",1261),
    ("Pune","Varanasi","Maharashtra","Uttar Pradesh",1456),
    ("Pune","Thiruvananthapuram","Maharashtra","Kerala",1350),
    ("Pune","Mysore","Maharashtra","Karnataka",917),
    ("Pune","Visakhapatnam","Maharashtra","Andhra Pradesh",1118),
    # Remaining city pairs (selected)
    ("Ahmedabad","Jaipur","Gujarat","Rajasthan",670),
    ("Ahmedabad","Lucknow","Gujarat","Uttar Pradesh",1072),
    ("Ahmedabad","Patna","Gujarat","Bihar",1548),
    ("Ahmedabad","Bhopal","Gujarat","Madhya Pradesh",455),
    ("Ahmedabad","Nagpur","Gujarat","Maharashtra",830),
    ("Ahmedabad","Indore","Gujarat","Madhya Pradesh",270),
    ("Ahmedabad","Chandigarh","Gujarat","Punjab",1155),
    ("Ahmedabad","Guwahati","Gujarat","Assam",2580),
    ("Ahmedabad","Vadodara","Gujarat","Gujarat",113),
    ("Ahmedabad","Agra","Gujarat","Uttar Pradesh",897),
    ("Ahmedabad","Varanasi","Gujarat","Uttar Pradesh",1196),
    ("Jaipur","Lucknow","Rajasthan","Uttar Pradesh",565),
    ("Jaipur","Agra","Rajasthan","Uttar Pradesh",235),
    ("Jaipur","Chandigarh","Rajasthan","Punjab",517),
    ("Jaipur","Amritsar","Rajasthan","Punjab",564),
    ("Jaipur","Varanasi","Rajasthan","Uttar Pradesh",720),
    ("Jaipur","Patna","Rajasthan","Bihar",1088),
    ("Lucknow","Patna","Uttar Pradesh","Bihar",517),
    ("Lucknow","Varanasi","Uttar Pradesh","Uttar Pradesh",286),
    ("Lucknow","Agra","Uttar Pradesh","Uttar Pradesh",363),
    ("Lucknow","Dehradun","Uttar Pradesh","Uttarakhand",513),
    ("Lucknow","Chandigarh","Uttar Pradesh","Punjab",601),
    ("Patna","Ranchi","Bihar","Jharkhand",330),
    ("Patna","Varanasi","Bihar","Uttar Pradesh",298),
    ("Patna","Guwahati","Bihar","Assam",1014),
    ("Bhopal","Indore","Madhya Pradesh","Madhya Pradesh",189),
    ("Bhopal","Nagpur","Madhya Pradesh","Maharashtra",356),
    ("Bhopal","Raipur","Madhya Pradesh","Chhattisgarh",470),
    ("Nagpur","Raipur","Maharashtra","Chhattisgarh",292),
    ("Nagpur","Ranchi","Maharashtra","Jharkhand",722),
    ("Indore","Vadodara","Madhya Pradesh","Gujarat",393),
    ("Chandigarh","Amritsar","Punjab","Punjab",225),
    ("Chandigarh","Dehradun","Punjab","Uttarakhand",199),
    ("Coimbatore","Kochi","Tamil Nadu","Kerala",185),
    ("Coimbatore","Mysore","Tamil Nadu","Karnataka",213),
    ("Coimbatore","Thiruvananthapuram","Tamil Nadu","Kerala",325),
    ("Kochi","Thiruvananthapuram","Kerala","Kerala",214),
    ("Kochi","Mysore","Kerala","Karnataka",461),
    ("Mysore","Thiruvananthapuram","Karnataka","Kerala",715),
    ("Guwahati","Ranchi","Assam","Jharkhand",1217),
    ("Ranchi","Bhubaneswar","Jharkhand","Odisha",520),
    ("Varanasi","Agra","Uttar Pradesh","Uttar Pradesh",575),
    ("Visakhapatnam","Bhubaneswar","Andhra Pradesh","Odisha",440),
    ("Visakhapatnam","Raipur","Andhra Pradesh","Chhattisgarh",535),
    ("Dehradun","Amritsar","Uttarakhand","Punjab",437),
    ("Dehradun","Agra","Uttarakhand","Uttar Pradesh",387),
    ("Amritsar","Agra","Punjab","Uttar Pradesh",608),
    ("Vadodara","Surat","Gujarat","Gujarat",153),
    ("Surat","Ahmedabad","Gujarat","Gujarat",266),
    ("Surat","Indore","Gujarat","Madhya Pradesh",434),
    ("Raipur","Ranchi","Chhattisgarh","Jharkhand",430),
    ("Raipur","Bhubaneswar","Chhattisgarh","Odisha",630),
]

# Build bidirectional rows
all_rows = []
seen = set()
for (o, d, so, sd, km) in distances_raw:
    for (city1, city2, s1, s2) in [(o,d,so,sd),(d,o,sd,so)]:
        key = (city1, city2)
        if key not in seen:
            seen.add(key)
            same_state = (s1 == s2)
            all_rows.append((city1, city2, s1, s2, km, same_state, False))

print(f"  Inserting {len(all_rows)} rows into city_distance_matrix...")

# Insert in batches of 100
def batch_insert_distance(rows):
    for i in range(0, len(rows), 100):
        batch = rows[i:i+100]
        vals = ",\n".join(
            f"('{o}','{d}','{so}','{sd}',{km},{str(ss).lower()},{str(sc).lower()})"
            for o,d,so,sd,km,ss,sc in batch
        )
        run_sql(f"INSERT INTO hackathon_workspace.travel_reference.city_distance_matrix VALUES {vals}",
                f"insert batch {i//100+1}")

batch_insert_distance(all_rows)
cols, rows = run_sql("SELECT COUNT(*) FROM hackathon_workspace.travel_reference.city_distance_matrix", "count")
print(f"  city_distance_matrix row count: {rows[0][0]}")

# ── TABLE 2: uber_intracity_estimates ─────────────────────────────────────────
print("\nCreating uber_intracity_estimates...")
run_sql("""
CREATE OR REPLACE TABLE hackathon_workspace.travel_reference.uber_intracity_estimates (
  city               STRING  COMMENT 'City name',
  state              STRING  COMMENT 'State name',
  distance_km_min    DOUBLE  COMMENT 'Lower bound of distance bucket in km',
  distance_km_max    DOUBLE  COMMENT 'Upper bound of distance bucket in km',
  travel_time_min_lo INT     COMMENT 'Lower estimate of travel time in minutes',
  travel_time_min_hi INT     COMMENT 'Upper estimate of travel time in minutes',
  fare_inr_lo        INT     COMMENT 'Lower estimate of cab fare in INR',
  fare_inr_hi        INT     COMMENT 'Upper estimate of cab fare in INR',
  surge_note         STRING  COMMENT 'Note about surge pricing conditions',
  tier               STRING  COMMENT 'City tier: TIER_1/TIER_2/TIER_3'
) USING DELTA
COMMENT 'Within-city Uber/Ola cab fare estimates for major Indian cities. Fares are 2024 approximate estimates.'
""", "create uber_intracity_estimates")

# city, state, tier, and per-bucket fares
# Buckets: 0-3, 3-7, 7-15, 15-30, 30+
# Format: (city, state, tier, [(dmin,dmax,t_lo,t_hi,f_lo,f_hi,surge_note), ...])
city_fares = [
    # TIER 1
    ("Mumbai","Maharashtra","TIER_1",[
        (0,3,   5,20,  80,150,  "Surge likely during peak hours (8-11am, 5-9pm)"),
        (3,7,   15,35, 150,280, "Surge likely during peak hours"),
        (7,15,  25,55, 280,520, "Surge likely during peak hours"),
        (15,30, 45,90, 520,950, "Moderate surge during peak hours"),
        (30,999,75,150,950,1800,"Heavy surge during peak hours"),
    ]),
    ("Delhi","Delhi","TIER_1",[
        (0,3,   5,18,  70,130,  "Surge likely during peak hours (9-11am, 6-9pm)"),
        (3,7,   15,30, 130,250, "Surge during peak hours"),
        (7,15,  25,50, 250,480, "Surge during peak hours"),
        (15,30, 40,80, 480,880, "Moderate surge during peak hours"),
        (30,999,70,140,880,1700,"Heavy surge; consider prepaid taxi"),
    ]),
    ("Bangalore","Karnataka","TIER_1",[
        (0,3,   8,22,  80,150,  "Heavy surge during peak hours (9-11am, 6-10pm)"),
        (3,7,   18,38, 150,280, "Heavy surge during peak hours"),
        (7,15,  30,60, 280,520, "Surge likely; traffic unpredictable"),
        (15,30, 50,100,520,950, "Heavy traffic; allow extra time"),
        (30,999,80,160,950,1800,"Consider hiring for full day"),
    ]),
    ("Chennai","Tamil Nadu","TIER_1",[
        (0,3,   6,20,  70,140,  "Surge during peak hours"),
        (3,7,   15,32, 140,260, "Surge during peak hours"),
        (7,15,  28,55, 260,490, "Surge during peak hours"),
        (15,30, 45,85, 490,900, "Moderate surge"),
        (30,999,75,150,900,1700,"Surge likely"),
    ]),
    ("Hyderabad","Telangana","TIER_1",[
        (0,3,   6,20,  70,140,  "Surge during peak hours"),
        (3,7,   15,32, 140,260, "Surge during peak hours"),
        (7,15,  28,55, 260,490, "Surge during peak hours"),
        (15,30, 45,85, 490,900, "Moderate surge during peak hours"),
        (30,999,75,150,900,1700,"Surge likely during peak hours"),
    ]),
    # TIER 2
    ("Pune","Maharashtra","TIER_2",[
        (0,3,   5,18,  60,110,  "Surge during peak hours"),
        (3,7,   12,28, 110,200, "Surge during peak hours"),
        (7,15,  22,45, 200,380, "Moderate surge during peak hours"),
        (15,30, 38,70, 380,700, "Moderate surge"),
        (30,999,60,120,700,1400,"Moderate surge"),
    ]),
    ("Kolkata","West Bengal","TIER_2",[
        (0,3,   6,20,  60,110,  "Surge during peak hours"),
        (3,7,   15,30, 110,200, "Surge during peak hours"),
        (7,15,  25,50, 200,380, "Surge during peak hours"),
        (15,30, 40,80, 380,700, "Moderate surge"),
        (30,999,65,130,700,1400,"Moderate surge"),
    ]),
    ("Ahmedabad","Gujarat","TIER_2",[
        (0,3,   5,18,  55,100,  "Mild surge during peak hours"),
        (3,7,   12,25, 100,190, "Mild surge"),
        (7,15,  20,42, 190,360, "Mild surge"),
        (15,30, 35,68, 360,660, "Mild surge"),
        (30,999,55,110,660,1300,"Moderate surge"),
    ]),
    ("Jaipur","Rajasthan","TIER_2",[
        (0,3,   5,18,  50,95,   "Mild surge during peak hours"),
        (3,7,   12,25, 95,180,  "Mild surge"),
        (7,15,  20,42, 180,340, "Mild surge"),
        (15,30, 35,65, 340,630, "Mild surge"),
        (30,999,55,110,630,1250,"Moderate surge"),
    ]),
    ("Lucknow","Uttar Pradesh","TIER_2",[
        (0,3,   5,18,  50,95,   "Surge during peak hours"),
        (3,7,   12,25, 95,180,  "Surge during peak hours"),
        (7,15,  20,40, 180,340, "Mild surge"),
        (15,30, 35,65, 340,620, "Mild surge"),
        (30,999,55,110,620,1250,"Moderate surge"),
    ]),
    ("Chandigarh","Punjab","TIER_2",[
        (0,3,   5,15,  50,90,   "Mild surge during peak hours"),
        (3,7,   10,22, 90,170,  "Mild surge"),
        (7,15,  18,38, 170,320, "Mild surge"),
        (15,30, 32,60, 320,600, "Mild surge"),
        (30,999,50,100,600,1200,"Mild surge"),
    ]),
    ("Kochi","Kerala","TIER_2",[
        (0,3,   6,20,  55,100,  "Surge during peak hours"),
        (3,7,   14,28, 100,190, "Surge during peak hours"),
        (7,15,  22,45, 190,360, "Surge during peak hours"),
        (15,30, 38,70, 360,660, "Moderate surge"),
        (30,999,60,120,660,1300,"Moderate surge"),
    ]),
    ("Coimbatore","Tamil Nadu","TIER_2",[
        (0,3,   5,18,  50,95,   "Mild surge during peak hours"),
        (3,7,   12,25, 95,180,  "Mild surge"),
        (7,15,  20,40, 180,340, "Mild surge"),
        (15,30, 35,65, 340,630, "Mild surge"),
        (30,999,55,110,630,1250,"Moderate surge"),
    ]),
    # TIER 3
    ("Patna","Bihar","TIER_3",[
        (0,3,   5,18,  40,80,   "Low surge; app-based cabs limited in some areas"),
        (3,7,   12,25, 80,150,  "Low surge"),
        (7,15,  20,40, 150,280, "Low surge"),
        (15,30, 35,65, 280,520, "Low surge"),
        (30,999,55,110,520,1000,"Low surge; consider hiring"),
    ]),
    ("Bhopal","Madhya Pradesh","TIER_3",[
        (0,3,   5,18,  40,80,   "Low surge; auto-rickshaw often cheaper"),
        (3,7,   12,25, 80,150,  "Low surge"),
        (7,15,  20,40, 150,280, "Low surge"),
        (15,30, 35,65, 280,520, "Low surge"),
        (30,999,55,110,520,1000,"Moderate surge"),
    ]),
    ("Raipur","Chhattisgarh","TIER_3",[
        (0,3,   5,18,  35,75,   "Low surge; Ola/Uber availability limited"),
        (3,7,   12,25, 75,140,  "Low surge"),
        (7,15,  20,40, 140,260, "Low surge"),
        (15,30, 35,65, 260,490, "Low surge"),
        (30,999,55,110,490,950, "Low surge"),
    ]),
    ("Guwahati","Assam","TIER_3",[
        (0,3,   5,20,  40,80,   "Low surge; Ola more available than Uber"),
        (3,7,   12,28, 80,150,  "Low surge"),
        (7,15,  22,45, 150,280, "Low surge"),
        (15,30, 38,70, 280,520, "Moderate surge"),
        (30,999,60,120,520,1000,"Moderate surge"),
    ]),
    ("Ranchi","Jharkhand","TIER_3",[
        (0,3,   5,18,  35,75,   "Low surge; limited cab availability"),
        (3,7,   12,25, 75,140,  "Low surge"),
        (7,15,  20,40, 140,260, "Low surge"),
        (15,30, 35,65, 260,490, "Low surge"),
        (30,999,55,110,490,950, "Low surge"),
    ]),
    ("Varanasi","Uttar Pradesh","TIER_3",[
        (0,3,   5,20,  40,80,   "Low surge; narrow lanes cause delays"),
        (3,7,   14,30, 80,150,  "Low surge"),
        (7,15,  22,45, 150,280, "Low surge"),
        (15,30, 38,70, 280,520, "Low surge"),
        (30,999,60,120,520,1000,"Moderate surge"),
    ]),
    ("Agra","Uttar Pradesh","TIER_3",[
        (0,3,   5,18,  40,80,   "Low surge"),
        (3,7,   12,25, 80,150,  "Low surge"),
        (7,15,  20,40, 150,280, "Low surge"),
        (15,30, 35,65, 280,520, "Low surge"),
        (30,999,55,110,520,1000,"Moderate surge"),
    ]),
    ("Amritsar","Punjab","TIER_3",[
        (0,3,   5,18,  40,80,   "Low surge"),
        (3,7,   12,25, 80,150,  "Low surge"),
        (7,15,  20,40, 150,280, "Low surge"),
        (15,30, 35,65, 280,520, "Low surge"),
        (30,999,55,110,520,1000,"Moderate surge"),
    ]),
]

uber_rows = []
for city, state, tier, buckets in city_fares:
    for dmin, dmax, tlo, thi, flo, fhi, surge in buckets:
        uber_rows.append((city, state, dmin, dmax, tlo, thi, flo, fhi, surge, tier))

print(f"  Inserting {len(uber_rows)} rows into uber_intracity_estimates...")
for i in range(0, len(uber_rows), 50):
    batch = uber_rows[i:i+50]
    vals = ",\n".join(
        f"('{c}','{st}',{dmin},{dmax},{tlo},{thi},{flo},{fhi},'{surge}','{tier}')"
        for c,st,dmin,dmax,tlo,thi,flo,fhi,surge,tier in batch
    )
    run_sql(f"INSERT INTO hackathon_workspace.travel_reference.uber_intracity_estimates VALUES {vals}",
            f"uber batch {i//50+1}")

cols, rows = run_sql("SELECT COUNT(*) FROM hackathon_workspace.travel_reference.uber_intracity_estimates", "count")
print(f"  uber_intracity_estimates row count: {rows[0][0]}")

print("\nPart 1 complete.")
