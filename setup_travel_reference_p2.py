"""
Part 2: ambulance_estimates + flight_route_estimates + intercity_cab_estimates
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

def insert_batch(table, rows, to_val):
    for i in range(0, len(rows), 50):
        batch = rows[i:i+50]
        vals = ",\n".join(to_val(r) for r in batch)
        run_sql(f"INSERT INTO {table} VALUES {vals}", f"batch {i//50+1}")

# ── TABLE 3: ambulance_estimates ──────────────────────────────────────────────
print("Creating ambulance_estimates...")
run_sql("""
CREATE OR REPLACE TABLE hackathon_workspace.travel_reference.ambulance_estimates (
  state              STRING  COMMENT 'Indian state or UT name',
  ambulance_type     STRING  COMMENT 'Type: GOVT_108 / GOVT_102 / PRIVATE_BLS / PRIVATE_ALS / PRIVATE_AIR',
  service_name       STRING  COMMENT 'Name of the ambulance service provider',
  contact_number     STRING  COMMENT 'Contact number to call',
  coverage_zone      STRING  COMMENT 'LOCAL (0-20km) / CITY (20-50km) / INTERCITY (50-300km) / LONG_DISTANCE (300km+)',
  cost_inr_lo        INT     COMMENT 'Minimum cost in INR (0 for government free services)',
  cost_inr_hi        INT     COMMENT 'Maximum cost in INR (0 for government free services)',
  is_free            BOOLEAN COMMENT 'True for government-funded free services',
  response_time_min  INT     COMMENT 'Average response time in minutes',
  available_24_7     BOOLEAN COMMENT 'True if service operates 24 hours, 7 days a week',
  notes              STRING  COMMENT 'Special notes about the service'
) USING DELTA
COMMENT 'Ambulance services by state and coverage zone. Covers government free services (108, 102) and private BLS/ALS/air ambulances.'
""", "create ambulance_estimates")

# Format: (state, amb_type, service, contact, zone, cost_lo, cost_hi, is_free, resp_min, 24x7, notes)
amb_rows = [
    # ── 108 GVK EMRI states ───────────────────────────────────────────────────
    *[("Maharashtra","GOVT_108","108 GVK EMRI","108","LOCAL",0,0,True,12,True,"Free emergency ambulance; ALS equipped in Mumbai metro")
      for _ in range(1)][:1],
    ("Maharashtra","GOVT_108","108 GVK EMRI","108","CITY",0,0,True,20,True,"Free emergency ambulance"),
    ("Maharashtra","GOVT_102","102 Janani Express","102","LOCAL",0,0,True,20,True,"Free maternity and newborn transport only"),
    ("Maharashtra","PRIVATE_BLS","StanPlus Ambulance","1800-313-1414","LOCAL",800,1500,False,15,True,"Basic life support; trained EMT on board"),
    ("Maharashtra","PRIVATE_BLS","StanPlus Ambulance","1800-313-1414","CITY",1500,3000,False,25,True,"Basic life support"),
    ("Maharashtra","PRIVATE_ALS","Medivic Ambulance","022-26441444","LOCAL",2000,4000,False,20,True,"Advanced life support; paramedic/doctor on board"),
    ("Maharashtra","PRIVATE_ALS","Medivic Ambulance","022-26441444","INTERCITY",4000,10000,False,35,True,"ALS intercity; prior booking required"),
    ("Maharashtra","PRIVATE_AIR","Comet Air Ambulance","1800-419-7399","LONG_DISTANCE",150000,500000,False,120,True,"Air ambulance from Mumbai; ICU-equipped aircraft"),

    ("Delhi","GOVT_108","CATS Delhi","102","LOCAL",0,0,True,10,True,"Centralised Accident & Trauma Services; best response time in metros"),
    ("Delhi","GOVT_108","CATS Delhi","102","CITY",0,0,True,18,True,"CATS coverage across Delhi NCR"),
    ("Delhi","GOVT_102","102 Janani Express","102","LOCAL",0,0,True,20,True,"Free maternity ambulance"),
    ("Delhi","PRIVATE_BLS","StanPlus Ambulance","1800-313-1414","LOCAL",1000,1800,False,15,True,"BLS equipped"),
    ("Delhi","PRIVATE_BLS","StanPlus Ambulance","1800-313-1414","CITY",1800,3500,False,25,True,"BLS; covers NCR region"),
    ("Delhi","PRIVATE_ALS","Ziqitza Healthcare","1800-103-5555","LOCAL",2500,5000,False,18,True,"ALS with ACLS-trained paramedic"),
    ("Delhi","PRIVATE_ALS","Ziqitza Healthcare","1800-103-5555","INTERCITY",5000,12000,False,40,True,"ALS intercity; Delhi to Agra/Chandigarh"),
    ("Delhi","PRIVATE_AIR","AirRescue Medical","011-49052323","LONG_DISTANCE",180000,600000,False,90,True,"Air ambulance from Delhi; Palam/IGI airport"),

    ("Karnataka","GOVT_108","108 GVK EMRI Karnataka","108","LOCAL",0,0,True,13,True,"Free emergency ambulance; ALS in Bangalore"),
    ("Karnataka","GOVT_108","108 GVK EMRI Karnataka","108","CITY",0,0,True,22,True,"Free emergency ambulance"),
    ("Karnataka","GOVT_102","102 Ksheema Karnataka","102","LOCAL",0,0,True,22,True,"Free maternity transport"),
    ("Karnataka","PRIVATE_BLS","Portea Medical","1800-121-2323","LOCAL",800,1500,False,20,True,"Home-to-hospital BLS"),
    ("Karnataka","PRIVATE_ALS","Apollo Gleneagles Ambulance","080-26304050","LOCAL",2000,4000,False,15,True,"ALS from Apollo hospitals network"),
    ("Karnataka","PRIVATE_ALS","Apollo Gleneagles Ambulance","080-26304050","INTERCITY",4500,11000,False,40,True,"ALS intercity; Bangalore to Mysore/Chennai"),
    ("Karnataka","PRIVATE_AIR","Air Ambulance India","080-46556655","LONG_DISTANCE",160000,550000,False,100,True,"Air ambulance from KIA Bangalore"),

    ("Tamil Nadu","GOVT_108","108 GVK EMRI Tamil Nadu","108","LOCAL",0,0,True,12,True,"Free emergency ambulance"),
    ("Tamil Nadu","GOVT_108","108 GVK EMRI Tamil Nadu","108","CITY",0,0,True,20,True,"Free emergency ambulance"),
    ("Tamil Nadu","GOVT_102","102 Thalikku Thaaai","102","LOCAL",0,0,True,22,True,"Free maternity and newborn transport"),
    ("Tamil Nadu","PRIVATE_BLS","Kauvery Ambulance","044-40006000","LOCAL",900,1600,False,18,True,"BLS; affiliated with Kauvery hospital chain"),
    ("Tamil Nadu","PRIVATE_ALS","Apollo Hospital Ambulance","044-28290200","LOCAL",2000,4000,False,15,True,"ALS from Apollo Chennai"),
    ("Tamil Nadu","PRIVATE_AIR","East India Ambulance","044-42181818","LONG_DISTANCE",140000,480000,False,110,True,"Air ambulance from Chennai airport"),

    ("Telangana","GOVT_108","108 GVK EMRI Telangana","108","LOCAL",0,0,True,11,True,"Free emergency ambulance; one of best response times nationally"),
    ("Telangana","GOVT_108","108 GVK EMRI Telangana","108","CITY",0,0,True,18,True,"Free emergency ambulance"),
    ("Telangana","GOVT_102","102 Maa Vedika","102","LOCAL",0,0,True,20,True,"Free maternity ambulance"),
    ("Telangana","PRIVATE_BLS","Star Ambulance","040-27891234","LOCAL",800,1500,False,18,True,"BLS service Hyderabad"),
    ("Telangana","PRIVATE_ALS","Yashoda Hospital Ambulance","040-45674567","LOCAL",2000,4000,False,15,True,"ALS from Yashoda hospitals"),
    ("Telangana","PRIVATE_AIR","Green Heli Air Ambulance","1800-102-4747","LONG_DISTANCE",155000,520000,False,100,True,"Air ambulance from RGIA Hyderabad"),

    ("West Bengal","GOVT_108","108 Pranadayini","108","LOCAL",0,0,True,14,True,"Free emergency ambulance Kolkata and districts"),
    ("West Bengal","GOVT_108","108 Pranadayini","108","CITY",0,0,True,25,True,"Free emergency ambulance"),
    ("West Bengal","GOVT_102","102 Niswartha","102","LOCAL",0,0,True,25,True,"Free maternity transport"),
    ("West Bengal","PRIVATE_BLS","SSKM Ambulance","033-22044444","LOCAL",700,1400,False,20,True,"BLS; Kolkata metro"),
    ("West Bengal","PRIVATE_ALS","Apollo Gleneagles Kolkata","033-23203040","LOCAL",2000,4000,False,18,True,"ALS; Apollo Gleneagles hospital"),
    ("West Bengal","PRIVATE_AIR","Air Med International","033-24497777","LONG_DISTANCE",150000,500000,False,120,True,"Air ambulance from Netaji Subhas airport"),

    ("Gujarat","GOVT_108","108 EMRI Gujarat","108","LOCAL",0,0,True,12,True,"Free emergency ambulance"),
    ("Gujarat","GOVT_108","108 EMRI Gujarat","108","CITY",0,0,True,20,True,"Free emergency ambulance"),
    ("Gujarat","GOVT_102","102 Chiranjeevi Yojana","102","LOCAL",0,0,True,22,True,"Free maternity ambulance; linked to Chiranjeevi scheme"),
    ("Gujarat","PRIVATE_BLS","Dial4242 Ambulance","4242","LOCAL",700,1400,False,15,True,"BLS; Ahmedabad and Surat"),
    ("Gujarat","PRIVATE_ALS","Zydus Hospital Ambulance","079-26860000","LOCAL",1800,3800,False,18,True,"ALS from Zydus hospitals"),
    ("Gujarat","PRIVATE_AIR","Angel Air Ambulance","1800-200-5555","LONG_DISTANCE",140000,480000,False,110,True,"Air ambulance from Ahmedabad airport"),

    ("Rajasthan","GOVT_108","108 Rajasthan","108","LOCAL",0,0,True,15,True,"Free emergency ambulance"),
    ("Rajasthan","GOVT_108","108 Rajasthan","108","CITY",0,0,True,25,True,"Free; coverage thinner in rural areas"),
    ("Rajasthan","GOVT_102","102 Janani Shishu Suraksha","102","LOCAL",0,0,True,25,True,"Free maternity transport"),
    ("Rajasthan","PRIVATE_BLS","Fortis Jaipur Ambulance","0141-2547000","LOCAL",800,1500,False,20,True,"BLS from Fortis hospital"),
    ("Rajasthan","PRIVATE_ALS","Medanta Jaipur Ambulance","0141-3541000","LOCAL",2000,4000,False,20,True,"ALS; prior booking preferred"),
    ("Rajasthan","PRIVATE_AIR","SOS Air Ambulance","1800-419-4000","LONG_DISTANCE",145000,490000,False,120,True,"Air ambulance from Jaipur airport"),

    ("Uttar Pradesh","GOVT_108","108 UP Ambulance","108","LOCAL",0,0,True,16,True,"Free emergency ambulance; variable response in smaller towns"),
    ("Uttar Pradesh","GOVT_108","108 UP Ambulance","108","CITY",0,0,True,28,True,"Free emergency ambulance"),
    ("Uttar Pradesh","GOVT_102","102 Janani Suraksha UP","102","LOCAL",0,0,True,28,True,"Free maternity transport"),
    ("Uttar Pradesh","PRIVATE_BLS","Medivic UP","0522-4004000","LOCAL",700,1400,False,22,True,"BLS; Lucknow and Kanpur"),
    ("Uttar Pradesh","PRIVATE_ALS","Medanta Lucknow","0522-4500000","LOCAL",2000,4500,False,20,True,"ALS from Medanta Lucknow"),
    ("Uttar Pradesh","PRIVATE_AIR","Air Ambulance India UP","1800-419-3333","LONG_DISTANCE",140000,480000,False,120,True,"Air ambulance from Lucknow/Varanasi airports"),

    ("Bihar","GOVT_108","108 Bihar EMRI","108","LOCAL",0,0,True,18,True,"Free emergency ambulance; response time higher in rural Bihar"),
    ("Bihar","GOVT_108","108 Bihar EMRI","108","CITY",0,0,True,30,True,"Free emergency ambulance"),
    ("Bihar","GOVT_102","102 Mamta Vahan","102","LOCAL",0,0,True,30,True,"Free maternity transport"),
    ("Bihar","PRIVATE_BLS","Patna Ambulance Services","0612-2521234","LOCAL",600,1200,False,25,True,"BLS; Patna metro only"),
    ("Bihar","PRIVATE_ALS","Ruban Memorial Hospital","0612-3501500","LOCAL",1800,3800,False,22,True,"ALS; limited ALS availability outside Patna"),
    ("Bihar","PRIVATE_AIR","North India Air Ambulance","1800-208-1234","LONG_DISTANCE",140000,470000,False,120,True,"Air ambulance from Patna airport"),

    ("Madhya Pradesh","GOVT_108","108 MP Dial","108","LOCAL",0,0,True,16,True,"Free emergency ambulance"),
    ("Madhya Pradesh","GOVT_108","108 MP Dial","108","CITY",0,0,True,28,True,"Free emergency ambulance"),
    ("Madhya Pradesh","GOVT_102","102 Janani Express MP","102","LOCAL",0,0,True,28,True,"Free maternity transport"),
    ("Madhya Pradesh","PRIVATE_BLS","Bhopal Ambulance","0755-4201234","LOCAL",650,1300,False,22,True,"BLS; Bhopal and Indore"),
    ("Madhya Pradesh","PRIVATE_ALS","Care Hospital Bhopal","0755-3981111","LOCAL",1800,3800,False,22,True,"ALS; prior booking preferred"),

    ("Odisha","GOVT_108","108 EMRI Odisha","108","LOCAL",0,0,True,15,True,"Free emergency ambulance"),
    ("Odisha","GOVT_108","108 EMRI Odisha","108","CITY",0,0,True,25,True,"Free emergency ambulance"),
    ("Odisha","GOVT_102","102 Mamata Yojana","102","LOCAL",0,0,True,25,True,"Free maternity transport linked to Mamata scheme"),
    ("Odisha","PRIVATE_BLS","SUM Hospital Ambulance","0674-2431444","LOCAL",700,1400,False,20,True,"BLS from SUM hospital Bhubaneswar"),
    ("Odisha","PRIVATE_ALS","AIIMS Bhubaneswar Ambulance","0674-2476789","LOCAL",1800,3800,False,18,True,"ALS; AIIMS Bhubaneswar"),

    ("Assam","GOVT_108","108 EMRI Assam","108","LOCAL",0,0,True,18,True,"Free emergency ambulance"),
    ("Assam","GOVT_108","108 EMRI Assam","108","CITY",0,0,True,30,True,"Free emergency ambulance; response may be slow in rural areas"),
    ("Assam","GOVT_102","102 Janani Suraksha Assam","102","LOCAL",0,0,True,30,True,"Free maternity transport"),
    ("Assam","PRIVATE_BLS","Guwahati Ambulance","0361-2347777","LOCAL",600,1200,False,25,True,"BLS; Guwahati city"),
    ("Assam","PRIVATE_ALS","Dispur Hospitals","0361-2228686","LOCAL",1800,3800,False,22,True,"ALS; limited outside Guwahati"),

    ("Chhattisgarh","GOVT_108","108 Drishti Ambulance","108","LOCAL",0,0,True,17,True,"Free emergency ambulance"),
    ("Chhattisgarh","GOVT_108","108 Drishti Ambulance","108","CITY",0,0,True,28,True,"Free emergency ambulance"),
    ("Chhattisgarh","GOVT_102","102 Janani Express CG","102","LOCAL",0,0,True,28,True,"Free maternity transport"),
    ("Chhattisgarh","PRIVATE_BLS","AIIMS Raipur Ambulance","0771-2572374","LOCAL",650,1300,False,22,True,"BLS from AIIMS Raipur"),

    ("Jharkhand","GOVT_108","108 EMRI Jharkhand","108","LOCAL",0,0,True,18,True,"Free emergency ambulance"),
    ("Jharkhand","GOVT_108","108 EMRI Jharkhand","108","CITY",0,0,True,30,True,"Free emergency ambulance"),
    ("Jharkhand","GOVT_102","102 Mamta Vahan JH","102","LOCAL",0,0,True,30,True,"Free maternity transport"),
    ("Jharkhand","PRIVATE_BLS","Ranchi Ambulance","0651-2330044","LOCAL",600,1200,False,25,True,"BLS; Ranchi city"),

    ("Punjab","GOVT_108","108 EMRI Punjab","108","LOCAL",0,0,True,12,True,"Free emergency ambulance"),
    ("Punjab","GOVT_108","108 EMRI Punjab","108","CITY",0,0,True,20,True,"Free emergency ambulance"),
    ("Punjab","GOVT_102","102 Janani Punjab","102","LOCAL",0,0,True,20,True,"Free maternity transport"),
    ("Punjab","PRIVATE_BLS","Fortis Chandigarh Ambulance","0172-5096001","LOCAL",800,1500,False,18,True,"BLS from Fortis Mohali"),
    ("Punjab","PRIVATE_ALS","PGI Chandigarh Ambulance","0172-2755555","LOCAL",0,0,True,15,True,"Free ALS from PGIMER Chandigarh; for referred patients"),

    ("Uttarakhand","GOVT_108","108 EMRI Uttarakhand","108","LOCAL",0,0,True,16,True,"Free emergency ambulance"),
    ("Uttarakhand","GOVT_108","108 EMRI Uttarakhand","108","CITY",0,0,True,28,True,"Free emergency ambulance"),
    ("Uttarakhand","GOVT_102","102 Janani Uttarakhand","102","LOCAL",0,0,True,28,True,"Free maternity transport"),
    ("Uttarakhand","PRIVATE_BLS","Max Dehradun Ambulance","0135-6620000","LOCAL",800,1500,False,20,True,"BLS from Max hospital Dehradun"),

    ("Andhra Pradesh","GOVT_108","108 EMRI Andhra Pradesh","108","LOCAL",0,0,True,12,True,"Free emergency ambulance; GVK EMRI operated"),
    ("Andhra Pradesh","GOVT_108","108 EMRI Andhra Pradesh","108","CITY",0,0,True,20,True,"Free emergency ambulance"),
    ("Andhra Pradesh","GOVT_102","102 NAS Andhra Pradesh","102","LOCAL",0,0,True,20,True,"Free maternity transport"),
    ("Andhra Pradesh","PRIVATE_BLS","Seven Hills Ambulance","0891-2748888","LOCAL",700,1400,False,18,True,"BLS; Visakhapatnam"),
    ("Andhra Pradesh","PRIVATE_ALS","Care Hospitals Visakhapatnam","0891-6677777","LOCAL",2000,4000,False,18,True,"ALS; prior booking preferred"),

    ("Kerala","GOVT_108","108 EMRI Kerala","108","LOCAL",0,0,True,12,True,"Free emergency ambulance"),
    ("Kerala","GOVT_108","108 EMRI Kerala","108","CITY",0,0,True,20,True,"Free emergency ambulance"),
    ("Kerala","GOVT_102","102 Janani Kerala","102","LOCAL",0,0,True,20,True,"Free maternity transport"),
    ("Kerala","PRIVATE_BLS","KIMS Ambulance Kochi","0484-2901000","LOCAL",800,1500,False,15,True,"BLS from KIMS hospital"),
    ("Kerala","PRIVATE_ALS","Aster Medcity Ambulance","0484-6699999","LOCAL",2000,4000,False,15,True,"ALS from Aster Medcity Kochi"),
    ("Kerala","PRIVATE_AIR","Sky Air Ambulance Kerala","1800-419-5553","LONG_DISTANCE",140000,480000,False,110,True,"Air ambulance from Kochi/Thiruvananthapuram"),

    # National private air ambulance (available pan-India)
    ("All States","PRIVATE_AIR","Ziqitza Air Ambulance","1800-103-5555","LONG_DISTANCE",200000,700000,False,120,True,"Pan-India air ambulance; ICU-on-wings; repatriation service"),
    ("All States","PRIVATE_AIR","SOS International Air","1800-419-4000","LONG_DISTANCE",180000,650000,False,120,True,"Pan-India air ambulance; 24/7 control room"),
]

def amb_val(r):
    state,atype,svc,contact,zone,clo,chi,free,resp,a247,notes = r
    free_s = str(free).lower()
    a247_s = str(a247).lower()
    return f"('{state}','{atype}','{svc}','{contact}','{zone}',{clo},{chi},{free_s},{resp},{a247_s},'{notes}')"

print(f"  Inserting {len(amb_rows)} rows into ambulance_estimates...")
insert_batch("hackathon_workspace.travel_reference.ambulance_estimates", amb_rows, amb_val)
cols, rows = run_sql("SELECT COUNT(*) FROM hackathon_workspace.travel_reference.ambulance_estimates", "count")
print(f"  ambulance_estimates row count: {rows[0][0]}")

# ── TABLE 4: flight_route_estimates ───────────────────────────────────────────
print("\nCreating flight_route_estimates...")
run_sql("""
CREATE OR REPLACE TABLE hackathon_workspace.travel_reference.flight_route_estimates (
  origin_city          STRING  COMMENT 'Origin city name',
  destination_city     STRING  COMMENT 'Destination city name',
  origin_airport       STRING  COMMENT 'Origin airport name and IATA code',
  destination_airport  STRING  COMMENT 'Destination airport name and IATA code',
  origin_state         STRING  COMMENT 'State of origin city',
  destination_state    STRING  COMMENT 'State of destination city',
  distance_km          DOUBLE  COMMENT 'Straight-line air distance in km',
  flight_duration_min  INT     COMMENT 'Typical flight duration in minutes',
  fare_economy_lo      INT     COMMENT 'Lower estimate of economy fare in INR',
  fare_economy_hi      INT     COMMENT 'Upper estimate of economy fare in INR',
  frequency            STRING  COMMENT 'MULTIPLE_DAILY / DAILY / FEW_WEEKLY',
  airlines             STRING  COMMENT 'Comma-separated list of airlines on this route',
  nearest_hospital_km_from_airport DOUBLE COMMENT 'Average distance from destination airport to major hospitals in destination city'
) USING DELTA
COMMENT 'Flight route estimates for top medical travel corridors in India. Fares are 2024 approximate economy class estimates.'
""", "create flight_route_estimates")

# (orig, dest, orig_airport, dest_airport, orig_state, dest_state, dist_km, dur_min, fare_lo, fare_hi, freq, airlines, hosp_km)
flight_rows = [
    ("Delhi","Mumbai","IGI Delhi (DEL)","CSIA Mumbai (BOM)","Delhi","Maharashtra",1143,120,3500,9000,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",18.0),
    ("Mumbai","Delhi","CSIA Mumbai (BOM)","IGI Delhi (DEL)","Maharashtra","Delhi",1143,120,3500,9000,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",25.0),
    ("Delhi","Chennai","IGI Delhi (DEL)","Chennai International (MAA)","Delhi","Tamil Nadu",1754,155,3800,9500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,GoFirst",14.0),
    ("Chennai","Delhi","Chennai International (MAA)","IGI Delhi (DEL)","Tamil Nadu","Delhi",1754,155,3800,9500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,GoFirst",25.0),
    ("Delhi","Bangalore","IGI Delhi (DEL)","Kempegowda International (BLR)","Delhi","Karnataka",1742,150,3500,9200,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",32.0),
    ("Bangalore","Delhi","Kempegowda International (BLR)","IGI Delhi (DEL)","Karnataka","Delhi",1742,150,3500,9200,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",25.0),
    ("Delhi","Hyderabad","IGI Delhi (DEL)","RGIA Hyderabad (HYD)","Delhi","Telangana",1262,120,3200,8500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,GoFirst",22.0),
    ("Hyderabad","Delhi","RGIA Hyderabad (HYD)","IGI Delhi (DEL)","Telangana","Delhi",1262,120,3200,8500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,GoFirst",25.0),
    ("Delhi","Kolkata","IGI Delhi (DEL)","Netaji Subhash Chandra Bose (CCU)","Delhi","West Bengal",1307,125,3200,8500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",18.0),
    ("Kolkata","Delhi","Netaji Subhash Chandra Bose (CCU)","IGI Delhi (DEL)","West Bengal","Delhi",1307,125,3200,8500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",25.0),
    ("Delhi","Kochi","IGI Delhi (DEL)","Cochin International (COK)","Delhi","Kerala",2090,165,4200,10500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",28.0),
    ("Kochi","Delhi","Cochin International (COK)","IGI Delhi (DEL)","Kerala","Delhi",2090,165,4200,10500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",25.0),
    ("Mumbai","Chennai","CSIA Mumbai (BOM)","Chennai International (MAA)","Maharashtra","Tamil Nadu",1032,100,3200,8000,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",14.0),
    ("Chennai","Mumbai","Chennai International (MAA)","CSIA Mumbai (BOM)","Tamil Nadu","Maharashtra",1032,100,3200,8000,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",18.0),
    ("Mumbai","Bangalore","CSIA Mumbai (BOM)","Kempegowda International (BLR)","Maharashtra","Karnataka",840,80,2800,7500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",32.0),
    ("Bangalore","Mumbai","Kempegowda International (BLR)","CSIA Mumbai (BOM)","Karnataka","Maharashtra",840,80,2800,7500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",18.0),
    ("Mumbai","Kolkata","CSIA Mumbai (BOM)","Netaji Subhash Chandra Bose (CCU)","Maharashtra","West Bengal",1660,140,3800,9200,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",18.0),
    ("Kolkata","Mumbai","Netaji Subhash Chandra Bose (CCU)","CSIA Mumbai (BOM)","West Bengal","Maharashtra",1660,140,3800,9200,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",18.0),
    ("Mumbai","Guwahati","CSIA Mumbai (BOM)","Lokpriya Gopinath Bordoloi (GAU)","Maharashtra","Assam",2107,175,5000,12000,"DAILY","IndiGo,Air India,GoFirst",12.0),
    ("Guwahati","Mumbai","Lokpriya Gopinath Bordoloi (GAU)","CSIA Mumbai (BOM)","Assam","Maharashtra",2107,175,5000,12000,"DAILY","IndiGo,Air India,GoFirst",18.0),
    ("Mumbai","Bhubaneswar","CSIA Mumbai (BOM)","Biju Patnaik International (BBI)","Maharashtra","Odisha",1452,120,3500,9000,"DAILY","IndiGo,Air India,SpiceJet",8.0),
    ("Bhubaneswar","Mumbai","Biju Patnaik International (BBI)","CSIA Mumbai (BOM)","Odisha","Maharashtra",1452,120,3500,9000,"DAILY","IndiGo,Air India,SpiceJet",18.0),
    ("Chennai","Kolkata","Chennai International (MAA)","Netaji Subhash Chandra Bose (CCU)","Tamil Nadu","West Bengal",1368,115,3500,8800,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",18.0),
    ("Kolkata","Chennai","Netaji Subhash Chandra Bose (CCU)","Chennai International (MAA)","West Bengal","Tamil Nadu",1368,115,3500,8800,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",14.0),
    ("Chennai","Guwahati","Chennai International (MAA)","Lokpriya Gopinath Bordoloi (GAU)","Tamil Nadu","Assam",1984,165,4500,11000,"DAILY","IndiGo,Air India",12.0),
    ("Guwahati","Chennai","Lokpriya Gopinath Bordoloi (GAU)","Chennai International (MAA)","Assam","Tamil Nadu",1984,165,4500,11000,"DAILY","IndiGo,Air India",14.0),
    ("Bangalore","Kolkata","Kempegowda International (BLR)","Netaji Subhash Chandra Bose (CCU)","Karnataka","West Bengal",1574,135,3800,9200,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",18.0),
    ("Kolkata","Bangalore","Netaji Subhash Chandra Bose (CCU)","Kempegowda International (BLR)","West Bengal","Karnataka",1574,135,3800,9200,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",32.0),
    ("Bangalore","Patna","Kempegowda International (BLR)","Jay Prakash Narayan (PAT)","Karnataka","Bihar",1762,155,4200,10500,"DAILY","IndiGo,Air India",7.0),
    ("Patna","Bangalore","Jay Prakash Narayan (PAT)","Kempegowda International (BLR)","Bihar","Karnataka",1762,155,4200,10500,"DAILY","IndiGo,Air India",32.0),
    ("Hyderabad","Kolkata","RGIA Hyderabad (HYD)","Netaji Subhash Chandra Bose (CCU)","Telangana","West Bengal",1189,110,3200,8500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",18.0),
    ("Kolkata","Hyderabad","Netaji Subhash Chandra Bose (CCU)","RGIA Hyderabad (HYD)","West Bengal","Telangana",1189,110,3200,8500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",22.0),
    ("Hyderabad","Guwahati","RGIA Hyderabad (HYD)","Lokpriya Gopinath Bordoloi (GAU)","Telangana","Assam",1756,155,4500,11000,"DAILY","IndiGo,Air India",12.0),
    ("Guwahati","Hyderabad","Lokpriya Gopinath Bordoloi (GAU)","RGIA Hyderabad (HYD)","Assam","Telangana",1756,155,4500,11000,"DAILY","IndiGo,Air India",22.0),
    ("Delhi","Guwahati","IGI Delhi (DEL)","Lokpriya Gopinath Bordoloi (GAU)","Delhi","Assam",1582,130,3800,9500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,GoFirst",12.0),
    ("Guwahati","Delhi","Lokpriya Gopinath Bordoloi (GAU)","IGI Delhi (DEL)","Assam","Delhi",1582,130,3800,9500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,GoFirst",25.0),
    ("Delhi","Patna","IGI Delhi (DEL)","Jay Prakash Narayan (PAT)","Delhi","Bihar",994,90,2800,7500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",7.0),
    ("Patna","Delhi","Jay Prakash Narayan (PAT)","IGI Delhi (DEL)","Bihar","Delhi",994,90,2800,7500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",25.0),
    ("Delhi","Lucknow","IGI Delhi (DEL)","Chaudhary Charan Singh (LKO)","Delhi","Uttar Pradesh",521,60,2200,6500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",14.0),
    ("Lucknow","Delhi","Chaudhary Charan Singh (LKO)","IGI Delhi (DEL)","Uttar Pradesh","Delhi",521,60,2200,6500,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet,Vistara",25.0),
    ("Delhi","Amritsar","IGI Delhi (DEL)","Sri Guru Ram Dass Jee (ATQ)","Delhi","Punjab",387,55,2500,6000,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",8.0),
    ("Amritsar","Delhi","Sri Guru Ram Dass Jee (ATQ)","IGI Delhi (DEL)","Punjab","Delhi",387,55,2500,6000,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",25.0),
    ("Delhi","Dehradun","IGI Delhi (DEL)","Jolly Grant Airport (DED)","Delhi","Uttarakhand",230,50,2200,5800,"DAILY","IndiGo,Air India",10.0),
    ("Dehradun","Delhi","Jolly Grant Airport (DED)","IGI Delhi (DEL)","Uttarakhand","Delhi",230,50,2200,5800,"DAILY","IndiGo,Air India",25.0),
    ("Mumbai","Ahmedabad","CSIA Mumbai (BOM)","Sardar Vallabhbhai Patel (AMD)","Maharashtra","Gujarat",435,55,2200,6000,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",12.0),
    ("Ahmedabad","Mumbai","Sardar Vallabhbhai Patel (AMD)","CSIA Mumbai (BOM)","Gujarat","Maharashtra",435,55,2200,6000,"MULTIPLE_DAILY","IndiGo,Air India,SpiceJet",18.0),
    ("Mumbai","Pune","CSIA Mumbai (BOM)","Pune Airport (PNQ)","Maharashtra","Maharashtra",120,45,1800,5000,"FEW_WEEKLY","IndiGo,Air India","Note: very short route; most travellers prefer road (148km, ~2.5hrs). Flights operate but limited."),
    ("Bangalore","Coimbatore","Kempegowda International (BLR)","Coimbatore International (CJB)","Karnataka","Tamil Nadu",282,55,2200,5800,"DAILY","IndiGo,Air India,SpiceJet",8.0),
    ("Coimbatore","Bangalore","Coimbatore International (CJB)","Kempegowda International (BLR)","Tamil Nadu","Karnataka",282,55,2200,5800,"DAILY","IndiGo,Air India,SpiceJet",32.0),
]

def flight_val(r):
    o,d,oa,da,os,ds,dist,dur,flo,fhi,freq,al,hkm = r
    # handle the Pune special note which has a long string in the hosp_km field
    if isinstance(hkm, str):
        return f"('{o}','{d}','{oa}','{da}','{os}','{ds}',{dist},{dur},{flo},{fhi},'{freq}','{al}',15.0)"
    return f"('{o}','{d}','{oa}','{da}','{os}','{ds}',{dist},{dur},{flo},{fhi},'{freq}','{al}',{hkm})"

print(f"  Inserting {len(flight_rows)} rows into flight_route_estimates...")
insert_batch("hackathon_workspace.travel_reference.flight_route_estimates", flight_rows, flight_val)
cols, rows = run_sql("SELECT COUNT(*) FROM hackathon_workspace.travel_reference.flight_route_estimates", "count")
print(f"  flight_route_estimates row count: {rows[0][0]}")

# ── TABLE 5: intercity_cab_estimates ──────────────────────────────────────────
print("\nCreating intercity_cab_estimates...")
run_sql("""
CREATE OR REPLACE TABLE hackathon_workspace.travel_reference.intercity_cab_estimates (
  distance_km_min    DOUBLE  COMMENT 'Lower bound of distance bucket in km',
  distance_km_max    DOUBLE  COMMENT 'Upper bound of distance bucket in km (use 9999 for open-ended)',
  travel_time_hr_lo  DOUBLE  COMMENT 'Lower estimate of travel time in hours',
  travel_time_hr_hi  DOUBLE  COMMENT 'Upper estimate of travel time in hours',
  fare_inr_lo        INT     COMMENT 'Lower estimate of intercity cab fare in INR',
  fare_inr_hi        INT     COMMENT 'Upper estimate of intercity cab fare in INR',
  recommended        BOOLEAN COMMENT 'True if cab is a recommended option for this distance range',
  notes              STRING  COMMENT 'Guidance notes for this distance bucket'
) USING DELTA
COMMENT 'Intercity cab fare and time estimates by distance bucket. For one-way trips using Ola Outstation, Uber Intercity, or hired local taxi.'
""", "create intercity_cab_estimates")

cab_rows = [
    (0,50,    0.5,1.5,  400,1200,   True,  "Short intercity or town-to-town trip. Cab strongly recommended. Affordable and fast. Auto or local taxi also available."),
    (50,100,  1.0,2.5,  800,2000,   True,  "Cab recommended. Use Ola Outstation or Uber Intercity for fixed-price booking. Faster than bus; cheaper than train for this distance."),
    (100,150, 2.0,3.5,  1200,3000,  True,  "Cab is viable. Consider shared taxi or prepaid outstation booking. Journey time comfortable for most patients."),
    (150,200, 3.0,5.0,  1800,4200,  True,  "Cab viable but train may be comparable in time. Use outstation booking to avoid surge. Rest stops advisable."),
    (200,300, 4.0,7.0,  2500,6000,  True,  "Cab possible but train often better value and more comfortable. Consider train if patient condition allows. Cab useful where train connectivity is poor."),
    (300,500, 6.0,11.0, 4500,10000, False, "Train strongly recommended over cab at this distance — more comfortable, cheaper, and safer for patients. Cab is an option only when rail connectivity is absent or in emergency where train schedule does not fit."),
    (500,9999,10.0,24.0,8000,20000, False, "Cab not recommended above 500km. Use flight (if affordable) or overnight train. Cab at this distance is fatiguing for patient and driver, and expensive."),
]

def cab_val(r):
    dmin,dmax,tlo,thi,flo,fhi,rec,notes = r
    rec_s = str(rec).lower()
    return f"({dmin},{dmax},{tlo},{thi},{flo},{fhi},{rec_s},'{notes}')"

print(f"  Inserting {len(cab_rows)} rows into intercity_cab_estimates...")
insert_batch("hackathon_workspace.travel_reference.intercity_cab_estimates", cab_rows, cab_val)
cols, rows = run_sql("SELECT COUNT(*) FROM hackathon_workspace.travel_reference.intercity_cab_estimates", "count")
print(f"  intercity_cab_estimates row count: {rows[0][0]}")

# ── Verification ──────────────────────────────────────────────────────────────
print("\n=== Final verification ===")
cols, rows = run_sql("SHOW TABLES IN hackathon_workspace.travel_reference", "show tables")
for row in rows:
    print(f"  {row}")

for tbl in ["city_distance_matrix","uber_intracity_estimates","ambulance_estimates","flight_route_estimates","intercity_cab_estimates"]:
    cols, rows = run_sql(f"SELECT COUNT(*) FROM hackathon_workspace.travel_reference.{tbl}", tbl)
    print(f"  {tbl}: {rows[0][0]} rows")

# Spot checks
print("\n--- Spot checks ---")
cols, rows = run_sql("SELECT * FROM hackathon_workspace.travel_reference.uber_intracity_estimates WHERE city = 'Mumbai' AND distance_km_min = 0", "Mumbai cab 0-3km")
print(f"  Mumbai 0-3km cab: {rows}")

cols, rows = run_sql("SELECT origin_city, destination_city, distance_km FROM hackathon_workspace.travel_reference.city_distance_matrix WHERE origin_city='Mumbai' AND destination_city='Pune'", "Mumbai-Pune")
print(f"  Mumbai→Pune distance: {rows}")

cols, rows = run_sql("SELECT state, ambulance_type, service_name, cost_inr_lo FROM hackathon_workspace.travel_reference.ambulance_estimates WHERE ambulance_type='GOVT_108' LIMIT 5", "108 services")
print(f"  108 services sample: {rows}")

print("\nAll done.")
