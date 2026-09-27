/* Novamart dataset — deterministic generator, shared with the SQL for Managers course (same seed, same rows).
   The same file runs in the browser (playground) and in Node (build-time validation),
   so every student sees exactly the same rows and every "expected output" matches. */
(function (root) {
  'use strict';

  /* ---------- deterministic randomness ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rnd = null;
  function rand() { return rnd(); }
  function randInt(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
  function chance(p) { return rand() < p; }
  function weighted(pairs) {
    var total = 0, i;
    for (i = 0; i < pairs.length; i++) total += pairs[i][1];
    var r = rand() * total;
    for (i = 0; i < pairs.length; i++) { r -= pairs[i][1]; if (r < 0) return pairs[i][0]; }
    return pairs[pairs.length - 1][0];
  }
  function round2(x) { return Math.round(x * 100) / 100; }

  /* ---------- date helpers (UTC arithmetic: identical in every timezone) ---------- */
  var DAY = 86400000;
  function dn(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / DAY); }
  function parts(n) { var t = new Date(n * DAY); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() }; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(n) { var p = parts(n); return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
  function ym(n) { var p = parts(n); return p.y + '-' + pad(p.m); }
  function daysInMonth(y, m) { return dn(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - dn(y, m, 1); }
  var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- reference lists ---------- */
  var FIRST_F = ['Aanya', 'Priya', 'Neha', 'Kavya', 'Ishita', 'Meera', 'Ananya', 'Sneha', 'Pooja', 'Riya', 'Divya', 'Shreya', 'Aditi', 'Nandini', 'Sakshi', 'Tanvi', 'Kritika', 'Lakshmi', 'Fatima', 'Zara', 'Simran', 'Harpreet', 'Anjali', 'Deepika', 'Swati', 'Ritika', 'Bhavya', 'Mahima', 'Rhea', 'Nikita', 'Ayesha', 'Gayatri', 'Payal', 'Sunita', 'Rekha'];
  var FIRST_M = ['Aarav', 'Rohan', 'Arjun', 'Vikram', 'Rahul', 'Karan', 'Aditya', 'Siddharth', 'Manish', 'Amit', 'Nikhil', 'Varun', 'Rajesh', 'Suresh', 'Vivek', 'Ankit', 'Harsh', 'Kunal', 'Mohit', 'Sanjay', 'Imran', 'Faisal', 'Gurpreet', 'Joseph', 'Thomas', 'Abhishek', 'Pranav', 'Yash', 'Dev', 'Ritesh', 'Naveen', 'Sameer', 'Tarun', 'Vinod', 'Ashok'];
  var LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Kumar', 'Patel', 'Shah', 'Mehta', 'Joshi', 'Nair', 'Menon', 'Iyer', 'Reddy', 'Rao', 'Naidu', 'Das', 'Bose', 'Chatterjee', 'Mukherjee', 'Khan', 'Ahmed', 'Sheikh', 'Kaur', 'Gill', 'Fernandes', "D'Souza", 'Pillai', 'Kulkarni', 'Deshpande', 'Chauhan', 'Rawat', 'Negi', 'Bisht', 'Thakur', 'Yadav', 'Mishra', 'Pandey', 'Tiwari', 'Agarwal', 'Jain', 'Bansal', 'Malhotra', 'Kapoor', 'Khanna', 'Chopra', 'Saxena', 'Bhatt', 'Nambiar'];
  var EMAIL_DOMAINS = [['gmail.com', 55], ['yahoo.in', 12], ['outlook.com', 14], ['rediffmail.com', 6], ['hotmail.com', 5], ['protonmail.com', 3], ['icloud.com', 5]];

  // [city, state, weight, region]
  var CITIES = [
    ['Delhi', 'Delhi', 14, 'North'], ['Mumbai', 'Maharashtra', 14, 'West'], ['Bengaluru', 'Karnataka', 13, 'South'],
    ['Hyderabad', 'Telangana', 9, 'South'], ['Chennai', 'Tamil Nadu', 8, 'South'], ['Kolkata', 'West Bengal', 7, 'East'],
    ['Pune', 'Maharashtra', 7, 'West'], ['Ahmedabad', 'Gujarat', 5, 'West'], ['Jaipur', 'Rajasthan', 4, 'North'],
    ['Lucknow', 'Uttar Pradesh', 4, 'North'], ['Dehradun', 'Uttarakhand', 3, 'North'], ['Chandigarh', 'Chandigarh', 3, 'North'],
    ['Kochi', 'Kerala', 3, 'South'], ['Indore', 'Madhya Pradesh', 3, 'West'], ['Gurugram', 'Haryana', 3, 'North'],
    ['Bhubaneswar', 'Odisha', 2, 'East'], ['Guwahati', 'Assam', 2, 'East'], ['Nagpur', 'Maharashtra', 2, 'West']
  ];

  // store_id, name, city, state, region, type, opened, sq_ft
  var STORES = [
    [1, 'Novamart Connaught Place', 'Delhi', 'Delhi', 'North', 'Flagship', '2019-03-15', 18000],
    [2, 'Novamart Andheri West', 'Mumbai', 'Maharashtra', 'West', 'Flagship', '2019-08-01', 16000],
    [3, 'Novamart Koramangala', 'Bengaluru', 'Karnataka', 'South', 'Flagship', '2020-01-20', 15000],
    [4, 'Novamart Banjara Hills', 'Hyderabad', 'Telangana', 'South', 'Standard', '2020-11-10', 9000],
    [5, 'Novamart T. Nagar', 'Chennai', 'Tamil Nadu', 'South', 'Standard', '2021-02-14', 8500],
    [6, 'Novamart Park Street', 'Kolkata', 'West Bengal', 'East', 'Standard', '2021-06-05', 8000],
    [7, 'Novamart Kothrud', 'Pune', 'Maharashtra', 'West', 'Standard', '2021-10-01', 7500],
    [8, 'Novamart SG Highway', 'Ahmedabad', 'Gujarat', 'West', 'Standard', '2022-03-12', 7000],
    [9, 'Novamart Malviya Nagar', 'Jaipur', 'Rajasthan', 'North', 'Standard', '2022-09-20', 6500],
    [10, 'Novamart Gomti Nagar', 'Lucknow', 'Uttar Pradesh', 'North', 'Standard', '2023-01-15', 6000],
    [11, 'Novamart Rajpur Road', 'Dehradun', 'Uttarakhand', 'North', 'Standard', '2023-07-01', 5000],
    [12, 'Novamart MG Road Kochi', 'Kochi', 'Kerala', 'South', 'Standard', '2024-04-10', 5500],
    [13, 'Novamart.in (Online)', 'Gurugram', 'Haryana', null, 'Online', '2020-06-01', null]
  ];
  var STORE_BY_CITY = {};
  STORES.forEach(function (s) { if (s[5] !== 'Online') STORE_BY_CITY[s[2]] = s[0]; });

  // name, category, sub_category, brand, list_price, cost_ratio, launch_date, is_active
  var PRODUCTS = [
    ['Voltra X1 Smartphone (128GB)', 'Electronics', 'Mobiles', 'Voltra', 18999, 0.83, '2023-02-01', 1],
    ['Voltra X1 Pro Smartphone (256GB)', 'Electronics', 'Mobiles', 'Voltra', 27999, 0.82, '2023-02-01', 1],
    ['Nimbus Lite 5G Smartphone', 'Electronics', 'Mobiles', 'Nimbus', 12499, 0.86, '2022-08-15', 0],
    ['Nimbus Fold Smartphone', 'Electronics', 'Mobiles', 'Nimbus', 64999, 0.8, '2025-06-01', 1],
    ['Orbit Book 14 Laptop (i5/16GB)', 'Electronics', 'Laptops', 'Orbit', 58990, 0.84, '2023-05-10', 1],
    ['Orbit Book 15 Laptop (i7/16GB)', 'Electronics', 'Laptops', 'Orbit', 84990, 0.83, '2023-05-10', 1],
    ['Orbit Air 13 Laptop', 'Electronics', 'Laptops', 'Orbit', 72990, 0.82, '2025-04-01', 1],
    ['Pulse Buds Wireless Earbuds', 'Electronics', 'Audio', 'Pulse', 2499, 0.55, '2022-03-01', 1],
    ['Pulse Beat Over-Ear Headphones', 'Electronics', 'Audio', 'Pulse', 5999, 0.58, '2022-03-01', 1],
    ['Pulse Boom Bluetooth Speaker', 'Electronics', 'Audio', 'Pulse', 3499, 0.57, '2023-01-15', 1],
    ['Voltra 65W Fast Charger', 'Electronics', 'Accessories', 'Voltra', 1299, 0.5, '2022-01-01', 1],
    ['Nimbus Power Bank 20000mAh', 'Electronics', 'Accessories', 'Nimbus', 1799, 0.52, '2022-01-01', 1],
    ['Orbit Wireless Mouse', 'Electronics', 'Accessories', 'Orbit', 899, 0.48, '2022-01-01', 1],
    ['Pulse Fit Smartwatch', 'Electronics', 'Wearables', 'Pulse', 4999, 0.6, '2022-09-01', 0],
    ['Pulse Fit Pro Smartwatch', 'Electronics', 'Wearables', 'Pulse', 9999, 0.62, '2025-03-01', 1],
    ['Voltra Smart Band 3', 'Electronics', 'Wearables', 'Voltra', 1999, 0.55, '2023-06-01', 1],

    ['Everline Slim Fit Chinos', 'Fashion', "Men's Apparel", 'Everline', 1899, 0.42, '2022-01-01', 1],
    ['Everline Oxford Shirt', 'Fashion', "Men's Apparel", 'Everline', 1499, 0.4, '2022-01-01', 1],
    ['Everline Cotton Polo T-Shirt', 'Fashion', "Men's Apparel", 'Everline', 899, 0.38, '2022-01-01', 1],
    ['Everline Formal Blazer', 'Fashion', "Men's Apparel", 'Everline', 4999, 0.45, '2022-09-01', 1],
    ['Aurelle Printed Kurta Set', 'Fashion', "Women's Apparel", 'Aurelle', 2299, 0.4, '2022-01-01', 1],
    ['Aurelle Linen Dress', 'Fashion', "Women's Apparel", 'Aurelle', 2799, 0.42, '2022-04-01', 1],
    ['Aurelle Denim Jacket', 'Fashion', "Women's Apparel", 'Aurelle', 2499, 0.44, '2022-10-01', 1],
    ['Aurelle Silk Saree', 'Fashion', "Women's Apparel", 'Aurelle', 5499, 0.46, '2022-01-01', 1],
    ['Stride Running Shoes', 'Fashion', 'Footwear', 'Stride', 3299, 0.5, '2022-01-01', 1],
    ['Stride Casual Sneakers', 'Fashion', 'Footwear', 'Stride', 2499, 0.48, '2022-01-01', 1],
    ['Stride Leather Loafers', 'Fashion', 'Footwear', 'Stride', 3999, 0.5, '2022-06-01', 1],
    ['Aurelle Block Heels', 'Fashion', 'Footwear', 'Aurelle', 1999, 0.45, '2022-01-01', 0],
    ['Everline Leather Belt', 'Fashion', 'Bags & Accessories', 'Everline', 999, 0.35, '2022-01-01', 1],
    ['Aurelle Tote Bag', 'Fashion', 'Bags & Accessories', 'Aurelle', 1799, 0.4, '2022-01-01', 1],
    ['Everline Laptop Backpack', 'Fashion', 'Bags & Accessories', 'Everline', 2199, 0.45, '2022-01-01', 1],
    ['Aurelle Sunglasses', 'Fashion', 'Bags & Accessories', 'Aurelle', 1299, 0.3, '2023-03-01', 1],

    ['Hestia 1.5 Ton Inverter AC', 'Home & Kitchen', 'Appliances', 'Hestia', 34999, 0.8, '2022-01-01', 1],
    ['Hestia 7kg Front Load Washing Machine', 'Home & Kitchen', 'Appliances', 'Hestia', 28999, 0.79, '2022-01-01', 1],
    ['Hestia 260L Refrigerator', 'Home & Kitchen', 'Appliances', 'Hestia', 24999, 0.8, '2022-01-01', 1],
    ['Hestia Microwave Oven 25L', 'Home & Kitchen', 'Appliances', 'Hestia', 8999, 0.72, '2022-01-01', 1],
    ['Hestia Mixer Grinder 750W', 'Home & Kitchen', 'Appliances', 'Hestia', 3299, 0.65, '2022-01-01', 1],
    ['Hestia Air Fryer 4.5L', 'Home & Kitchen', 'Appliances', 'Hestia', 5499, 0.66, '2025-01-15', 1],
    ['Terra Non-stick Cookware Set (5 pc)', 'Home & Kitchen', 'Cookware', 'Terra', 2999, 0.5, '2022-01-01', 1],
    ['Terra Pressure Cooker 5L', 'Home & Kitchen', 'Cookware', 'Terra', 1899, 0.52, '2022-01-01', 1],
    ['Terra Cast Iron Kadai', 'Home & Kitchen', 'Cookware', 'Terra', 1599, 0.5, '2022-01-01', 1],
    ['Terra Dinner Set (24 pc)', 'Home & Kitchen', 'Dining', 'Terra', 2499, 0.48, '2022-01-01', 1],
    ['Loom & Light Cotton Bedsheet Set', 'Home & Kitchen', 'Decor', 'Loom & Light', 1499, 0.45, '2022-01-01', 1],
    ['Loom & Light Scented Candle Trio', 'Home & Kitchen', 'Decor', 'Loom & Light', 799, 0.35, '2022-01-01', 1],
    ['Loom & Light Wall Clock', 'Home & Kitchen', 'Decor', 'Loom & Light', 1199, 0.4, '2022-01-01', 0],
    ['Terra Study Table', 'Home & Kitchen', 'Furniture', 'Terra', 6999, 0.6, '2022-01-01', 1],

    ['Glow Vitamin C Serum', 'Beauty & Personal Care', 'Skincare', 'Glow', 699, 0.32, '2022-01-01', 1],
    ['Glow SPF 50 Sunscreen', 'Beauty & Personal Care', 'Skincare', 'Glow', 499, 0.3, '2022-01-01', 1],
    ['Glow Hydrating Moisturiser', 'Beauty & Personal Care', 'Skincare', 'Glow', 599, 0.3, '2022-01-01', 1],
    ['Glow Foaming Face Wash', 'Beauty & Personal Care', 'Skincare', 'Glow', 249, 0.3, '2022-01-01', 1],
    ['Mane Argan Oil Shampoo', 'Beauty & Personal Care', 'Haircare', 'Mane', 449, 0.33, '2022-01-01', 1],
    ['Mane Hair Serum', 'Beauty & Personal Care', 'Haircare', 'Mane', 399, 0.33, '2022-01-01', 1],
    ['Mane Hair Dryer 1800W', 'Beauty & Personal Care', 'Haircare', 'Mane', 1899, 0.6, '2022-01-01', 1],
    ['Essence Eau de Parfum 100ml', 'Beauty & Personal Care', 'Fragrance', 'Essence', 2499, 0.3, '2022-01-01', 1],
    ['Essence Body Mist', 'Beauty & Personal Care', 'Fragrance', 'Essence', 599, 0.3, '2022-01-01', 1],
    ['Glow Matte Lipstick', 'Beauty & Personal Care', 'Makeup', 'Glow', 549, 0.3, '2025-02-01', 1],

    ['Stride Yoga Mat 6mm', 'Sports & Outdoors', 'Fitness', 'Stride', 999, 0.45, '2022-01-01', 1],
    ['Stride Adjustable Dumbbells (20kg)', 'Sports & Outdoors', 'Fitness', 'Stride', 4499, 0.6, '2022-01-01', 1],
    ['Stride Resistance Bands Set', 'Sports & Outdoors', 'Fitness', 'Stride', 599, 0.4, '2022-01-01', 1],
    ['Stride Treadmill T200', 'Sports & Outdoors', 'Fitness', 'Stride', 32999, 0.75, '2022-01-01', 1],
    ['Stride Dri-Fit Training T-Shirt', 'Sports & Outdoors', 'Sportswear', 'Stride', 799, 0.38, '2022-01-01', 1],
    ['Stride Track Pants', 'Sports & Outdoors', 'Sportswear', 'Stride', 1199, 0.4, '2022-01-01', 1],
    ['Trailhead 2-Person Tent', 'Sports & Outdoors', 'Outdoor', 'Trailhead', 4999, 0.55, '2022-01-01', 1],
    ['Trailhead Insulated Bottle 1L', 'Sports & Outdoors', 'Outdoor', 'Trailhead', 899, 0.42, '2022-01-01', 1],

    ['Harvest Basmati Rice 5kg', 'Grocery & Gourmet', 'Staples', 'Harvest', 649, 0.86, '2022-01-01', 1],
    ['Harvest Cold-Pressed Groundnut Oil 1L', 'Grocery & Gourmet', 'Staples', 'Harvest', 349, 0.84, '2022-01-01', 1],
    ['Harvest Toor Dal 1kg', 'Grocery & Gourmet', 'Staples', 'Harvest', 189, 0.88, '2022-01-01', 1],
    ['Harvest Organic Honey 500g', 'Grocery & Gourmet', 'Staples', 'Harvest', 399, 0.7, '2022-01-01', 1],
    ['Brew Bros Arabica Coffee 250g', 'Grocery & Gourmet', 'Beverages', 'Brew Bros', 549, 0.6, '2022-01-01', 1],
    ['Brew Bros Masala Chai 500g', 'Grocery & Gourmet', 'Beverages', 'Brew Bros', 299, 0.62, '2022-01-01', 1],
    ['Munchly Baked Chips (Pack of 6)', 'Grocery & Gourmet', 'Snacks', 'Munchly', 240, 0.7, '2022-01-01', 1],
    ['Munchly Trail Mix 500g', 'Grocery & Gourmet', 'Snacks', 'Munchly', 449, 0.65, '2022-01-01', 1]
  ];
  var DISCONTINUED_AFTER = dn(2025, 12, 31); // is_active = 0 products stop selling after this date

  var CAMPAIGNS = [
    [1, 'Republic Day Sale 2024', 'Search', 'Conversion', '2024-01-20', '2024-01-28', 800000],
    [2, 'Summer Cool 2024', 'Paid Social', 'Acquisition', '2024-04-15', '2024-05-15', 1200000],
    [3, 'Monsoon Fashion Fest 2024', 'Influencer', 'Awareness', '2024-07-10', '2024-07-31', 600000],
    [4, 'Big Diwali Dhamaka 2024', 'TV', 'Awareness', '2024-10-20', '2024-11-05', 5000000],
    [5, 'New Year New You 2025', 'Email', 'Retention', '2025-01-01', '2025-01-15', 150000],
    [6, 'Holi Colours 2025', 'Paid Social', 'Conversion', '2025-03-05', '2025-03-16', 700000],
    [7, 'Back to Campus 2025', 'Search', 'Acquisition', '2025-07-01', '2025-07-31', 900000],
    [8, 'Big Diwali Dhamaka 2025', 'TV', 'Awareness', '2025-10-10', '2025-10-25', 6000000],
    [9, 'Winter Warmers 2025', 'Email', 'Retention', '2025-12-01', '2025-12-20', 200000],
    [10, 'App Launch Bonanza 2026', 'Paid Social', 'Acquisition', '2026-02-01', '2026-02-28', 1500000]
  ];

  var DEPARTMENTS = [
    [1, 'Executive Office', 12000000, 'Gurugram HQ'],
    [2, 'Sales & Store Operations', 95000000, 'Gurugram HQ'],
    [3, 'Marketing', 42000000, 'Gurugram HQ'],
    [4, 'Finance & Accounts', 18000000, 'Gurugram HQ'],
    [5, 'Human Resources', 11000000, 'Gurugram HQ'],
    [6, 'Technology & Data', 36000000, 'Bengaluru Tech Centre'],
    [7, 'Supply Chain & Logistics', 48000000, 'Gurugram HQ']
  ];

  var SEASON = { 1: 1.1, 2: 0.9, 3: 0.95, 4: 0.9, 5: 0.95, 6: 0.9, 7: 1.0, 8: 1.05, 9: 1.0, 10: 1.5, 11: 1.45, 12: 1.15 };
  var DOW_W = [1.3, 1.0, 0.95, 0.95, 1.0, 1.1, 1.35]; // Sun..Sat

  /* ---------- data dictionary (shown in the playground's schema browser) ---------- */
  var DOCS = {
    stores: { desc: 'One row per Novamart store. store_id 13 is the online store (region is NULL for it).', cols: { store_id: 'Primary key', store_name: 'Display name', city: 'City', state: 'State', region: 'North / South / East / West; NULL for online', store_type: 'Flagship, Standard or Online', opened_date: 'Opening date (Kochi opened 2024-04-10, mid-dataset)', sq_ft: 'Floor area; NULL for online' } },
    customers: { desc: 'One row per registered customer (500). Some emails, phones and birth years are missing on purpose.', cols: { customer_id: 'Primary key', full_name: 'Name', email: 'May be NULL', phone: 'May be NULL', gender: 'F / M / NULL', birth_year: 'Year of birth; may be NULL', city: 'Home city', state: 'Home state', segment: 'Consumer, Corporate or Small Business', acquisition_channel: 'How the customer first came to Novamart', signup_date: 'Registration date', loyalty_tier: 'Bronze / Silver / Gold; NULL = not enrolled' } },
    products: { desc: 'Product catalogue (72 SKUs) across 6 categories. Four products are discontinued (is_active = 0).', cols: { product_id: 'Primary key', product_name: 'Name', category: 'Top-level category', sub_category: 'Sub-category', brand: 'Brand (all fictional)', unit_cost: 'Cost to Novamart, INR', list_price: 'Current shelf price, INR', launch_date: 'First day on sale', is_active: '1 = on sale, 0 = discontinued' } },
    campaigns: { desc: 'Marketing campaigns with their windows and budgets.', cols: { campaign_id: 'Primary key', campaign_name: 'Name', channel: 'Search, Paid Social, Influencer, TV, Email', objective: 'Awareness / Acquisition / Conversion / Retention', start_date: 'First day', end_date: 'Last day', budget: 'Budget, INR' } },
    orders: { desc: 'Order headers, Jan 2024 to Aug 2026 (3,000). Line amounts live in order_items.', cols: { order_id: 'Primary key', customer_id: 'FK to customers', store_id: 'FK to stores (13 = online)', campaign_id: 'Attributed campaign; NULL if none', order_date: 'Date placed', ship_date: 'Date shipped / handed over; NULL if cancelled or still processing', status: 'Delivered, Cancelled, Returned or Processing', channel: 'Store, Online or App', payment_method: 'UPI, Card, Cash, COD, NetBanking, Wallet', shipping_fee: 'INR; 0 for store purchases' } },
    order_items: { desc: 'Order lines. Revenue for a line = quantity * unit_price * (1 - discount_pct/100).', cols: { order_item_id: 'Primary key', order_id: 'FK to orders', product_id: 'FK to products', quantity: 'Units', unit_price: 'Price charged per unit at the time (can differ from list_price)', discount_pct: 'Discount percentage applied to the line' } },
    returns: { desc: 'Product returns, including partial returns on orders whose status is still Delivered.', cols: { return_id: 'Primary key', order_id: 'FK to orders', product_id: 'FK to products', return_date: 'Date received back', reason: 'Defective, Wrong item, Size issue, Changed mind, Late delivery', refund_amount: 'INR refunded', approved: '1 = refund approved, 0 = rejected' } },
    departments: { desc: 'Seven departments with annual budgets.', cols: { dept_id: 'Primary key', dept_name: 'Name', annual_budget: 'INR per year', location: 'Where the department sits' } },
    employees: { desc: 'Current and former employees. manager_id points at another employee (NULL for the CEO).', cols: { emp_id: 'Primary key', full_name: 'Name', dept_id: 'FK to departments', job_title: 'Title', store_id: 'FK to stores; NULL for head office roles', manager_id: 'FK to employees (self-join)', gender: 'F / M', city: 'Work city', hire_date: 'Joining date', exit_date: 'Leaving date; NULL = still employed', monthly_salary: 'Gross monthly salary, INR', performance_rating: '1 (low) to 5 (high); NULL if no completed review cycle' } },
    monthly_targets: { desc: 'Revenue target per store per month, from each store’s opening month.', cols: { store_id: 'FK to stores', month: "Calendar month as 'YYYY-MM'", target_revenue: 'Target, INR' } },
    inventory: { desc: 'Stock position per store and product as of 31 Aug 2026.', cols: { store_id: 'FK to stores (13 = central warehouse for online)', product_id: 'FK to products', stock_on_hand: 'Units in stock; 0 = stock-out', reorder_level: 'Reorder when stock falls to this level', last_restock_date: 'Last replenishment' } },
    web_events: { desc: 'Clickstream for Novamart.in and the app, Jun–Aug 2026. One session walks page_view → product_view → add_to_cart → checkout → purchase, dropping out along the way.', cols: { event_id: 'Primary key', session_id: 'Groups events of one visit', customer_id: 'FK to customers; NULL when the visitor was not logged in', event_time: "Timestamp 'YYYY-MM-DD HH:MM:SS'", event_type: 'Funnel step', device: 'Mobile, Desktop or Tablet' } },
    raw_leads: { desc: 'A raw export from the website lead form. Deliberately messy: duplicates, odd casing, spaces, mixed date formats, broken emails.', cols: { lead_id: 'Primary key', full_name: 'As typed', email: 'As typed', phone: 'As typed', city: 'As typed', source: 'As typed', created_at: 'Text in several formats', status: 'New, Contacted, Qualified, Lost or NULL' } },
    nps_responses: { desc: 'Post-purchase survey answers (0–10).', cols: { response_id: 'Primary key', customer_id: 'FK to customers', order_id: 'FK to orders (the order the survey followed)', survey_date: 'Date answered', score: '0–10; 9–10 promoters, 7–8 passives, 0–6 detractors', comment: 'Free text; often NULL' } }
  };

  /* ---------- generator ---------- */
  function generate() {
    rnd = mulberry32(20260915);
    var T = {};

    // stores
    T.stores = STORES.map(function (s) { return s.slice(); });

    // customers
    var customers = [], custIndex = {}, usedEmails = {};
    var cityPairs = CITIES.map(function (c) { return [c, c[2]]; });
    var signupStart = dn(2022, 1, 1), signupEnd = dn(2026, 7, 31);
    for (var ci = 1; ci <= 500; ci++) {
      var gender = weighted([['F', 47], ['M', 50], [null, 3]]);
      var first = gender === 'F' ? pick(FIRST_F) : gender === 'M' ? pick(FIRST_M) : pick(chance(0.5) ? FIRST_F : FIRST_M);
      var last = pick(LAST);
      var name = first + ' ' + last;
      var email = null;
      if (!chance(0.06)) {
        var base = (first + '.' + last).toLowerCase().replace(/[^a-z.]/g, '');
        var dom = weighted(EMAIL_DOMAINS);
        email = base + '@' + dom;
        if (usedEmails[email]) email = base + randInt(2, 99) + '@' + dom;
        usedEmails[email] = 1;
      }
      var phone = chance(0.1) ? null : '+91 ' + randInt(6, 9) + '' + randInt(1000, 9999) + '' + randInt(10000, 99999);
      var birth = chance(0.08) ? null : weighted([[randInt(1962, 1975), 15], [randInt(1976, 1985), 25], [randInt(1986, 1995), 35], [randInt(1996, 2004), 25]]);
      var city = weighted(cityPairs);
      var segment = weighted([['Consumer', 70], ['Corporate', 14], ['Small Business', 16]]);
      var acq = weighted([['Organic Search', 22], ['Paid Social', 20], ['Referral', 15], ['Email', 8], ['Store Walk-in', 27], ['Influencer', 8]]);
      // sign-ups grow over time
      var su = signupStart + Math.floor(Math.pow(rand(), 0.7) * (signupEnd - signupStart));
      var tier = weighted([[null, 45], ['Bronze', 30], ['Silver', 17], ['Gold', 8]]);
      var activity = Math.exp(-rand() * 3.2); // heavy-tailed buying propensity
      var row = [ci, name, email, phone, gender, birth, city[0], city[1], segment, acq, iso(su), tier];
      customers.push(row);
      custIndex[ci] = { signup: su, city: city[0], activity: activity, segment: segment };
    }
    T.customers = customers;

    // products
    var products = [], prodMeta = [];
    PRODUCTS.forEach(function (p, i) {
      var pid = 101 + i;
      var cost = round2(p[4] * p[5]);
      products.push([pid, p[0], p[1], p[2], p[3], cost, p[4], p[6], p[7]]);
      var pop = 1 / Math.sqrt(p[4] / 1000 + 0.6);
      if (p[1] === 'Grocery & Gourmet') pop *= 0.9;
      if (p[1] === 'Beauty & Personal Care') pop *= 1.1;
      if (p[1] === 'Electronics') pop *= 1.35;
      if (p[1] === 'Fashion') pop *= 1.2;
      prodMeta.push({ id: pid, price: p[4], pop: pop, launch: dn.apply(null, p[6].split('-').map(Number)), active: p[7], cat: p[1] });
    });
    T.products = products;

    // campaigns
    T.campaigns = CAMPAIGNS.map(function (c) { return c.slice(); });
    var campMeta = CAMPAIGNS.map(function (c) { return { id: c[0], ch: c[2], start: dn.apply(null, c[4].split('-').map(Number)), end: dn.apply(null, c[5].split('-').map(Number)) }; });

    // orders + items
    var months = [];
    for (var y = 2024; y <= 2026; y++) for (var m = 1; m <= 12; m++) { if (y === 2026 && m > 8) break; months.push([y, m]); }
    var weights = months.map(function (mm, i) { return SEASON[mm[1]] * (1 + 0.021 * i); });
    var wsum = weights.reduce(function (a, b) { return a + b; }, 0);
    var TOTAL_ORDERS = 3000;
    var counts = weights.map(function (w) { return Math.floor(TOTAL_ORDERS * w / wsum); });
    var rem = TOTAL_ORDERS - counts.reduce(function (a, b) { return a + b; }, 0);
    for (var r = 0; r < rem; r++) counts[r % counts.length]++;

    var storeOpen = {};
    STORES.forEach(function (s) { storeOpen[s[0]] = dn.apply(null, s[6].split('-').map(Number)); });
    var physical = STORES.filter(function (s) { return s[5] !== 'Online'; });

    var orders = [], items = [], orderMeta = {};
    var oid = 10001, oiid = 1;
    var lastDay = dn(2026, 8, 31);
    months.forEach(function (mm, mi) {
      var y = mm[0], mo = mm[1], n = counts[mi], dim = daysInMonth(y, mo);
      var dayPairs = [];
      for (var d = 1; d <= dim; d++) dayPairs.push([d, DOW_W[parts(dn(y, mo, d)).dow]]);
      for (var k = 0; k < n; k++) {
        var day = dn(y, mo, weighted(dayPairs));
        // customer: eligible = signed up on/before the day, weighted by activity
        var cand = [];
        for (var c = 1; c <= 500; c++) if (custIndex[c].signup <= day) cand.push([c, custIndex[c].activity]);
        if (!cand.length) cand.push([1, 1]);
        var cust = weighted(cand);
        var channel = weighted([['Store', 46], ['Online', 34], ['App', mi < 12 ? 12 : 22]]);
        var store;
        if (channel === 'Store') {
          var home = STORE_BY_CITY[custIndex[cust].city];
          if (home && storeOpen[home] <= day && chance(0.78)) store = home;
          else {
            var open = physical.filter(function (s) { return storeOpen[s[0]] <= day; });
            store = weighted(open.map(function (s) { return [s[0], s[7] / 1000]; }));
          }
        } else store = 13;
        var status = weighted([['Delivered', 84], ['Cancelled', 6], ['Returned', 6], ['Processing', day >= dn(2026, 8, 24) ? 40 : 0]]);
        var ship = null;
        if (status === 'Delivered' || status === 'Returned') {
          ship = day + (channel === 'Store' ? 0 : weighted([[1, 40], [2, 30], [3, 15], [4, 8], [5, 4], [7, 3]]));
          if (ship > lastDay) ship = lastDay;
        }
        var pay = channel === 'Store' ? weighted([['Cash', 28], ['Card', 36], ['UPI', 36]])
          : channel === 'Online' ? weighted([['UPI', 44], ['Card', 26], ['COD', 12], ['NetBanking', 8], ['Wallet', 10]])
            : weighted([['UPI', 50], ['Card', 15], ['COD', 10], ['Wallet', 25]]);
        // campaign attribution
        var camp = null;
        for (var q = 0; q < campMeta.length; q++) {
          var cm = campMeta[q];
          if (day >= cm.start && day <= cm.end) {
            var p = cm.ch === 'TV' ? 0.22 : (channel === 'Store' ? 0.05 : 0.42);
            if (chance(p)) { camp = cm.id; break; }
          }
        }
        // lines
        var nLines = weighted([[1, 38], [2, 30], [3, 18], [4, 9], [5, 5]]);
        var avail = prodMeta.filter(function (pm) { return pm.launch <= day && (pm.active || day <= DISCONTINUED_AFTER); });
        var chosen = {}, subtotal = 0;
        var festive = (mo === 10 || mo === 11 || mo === 1);
        for (var li = 0; li < nLines; li++) {
          var pm = weighted(avail.map(function (a) { return [a, a.pop]; }));
          if (chosen[pm.id]) continue;
          chosen[pm.id] = 1;
          var qty = weighted([[1, 70], [2, 20], [3, 7], [4, 3]]);
          if (pm.cat === 'Grocery & Gourmet') qty = weighted([[1, 40], [2, 30], [3, 20], [4, 10]]);
          var price = pm.price;
          if (chance(0.12)) price = Math.round(pm.price * (chance(0.5) ? 0.95 : 1.05));
          var disc = weighted([[0, festive ? 40 : 62], [5, 12], [10, 13], [15, 6], [20, festive ? 15 : 5], [30, festive ? 10 : 2], [40, festive ? 4 : 0]]);
          items.push([oiid++, oid, pm.id, qty, price, disc]);
          subtotal += qty * price * (1 - disc / 100);
        }
        var fee = channel === 'Store' ? 0 : (subtotal >= 999 ? 0 : 49);
        orders.push([oid, cust, store, camp, iso(day), ship === null ? null : iso(ship), status, channel, pay, fee]);
        orderMeta[oid] = { day: day, ship: ship, status: status, store: store, channel: channel, cust: cust, subtotal: subtotal };
        oid++;
      }
    });
    T.orders = orders;
    T.order_items = items;

    // returns
    var itemsByOrder = {};
    items.forEach(function (it) { (itemsByOrder[it[1]] = itemsByOrder[it[1]] || []).push(it); });
    var prodCat = {}; prodMeta.forEach(function (pm) { prodCat[pm.id] = pm.cat; });
    var returns = [], rid = 1;
    orders.forEach(function (o) {
      var om = orderMeta[o[0]];
      var doReturn = om.status === 'Returned' || (om.status === 'Delivered' && chance(0.02));
      if (!doReturn || om.ship === null) return;
      var lines = itemsByOrder[o[0]];
      var it = pick(lines);
      var cat = prodCat[it[2]];
      var reason = cat === 'Fashion' ? weighted([['Size issue', 45], ['Changed mind', 25], ['Wrong item', 15], ['Defective', 10], ['Late delivery', 5]])
        : cat === 'Electronics' ? weighted([['Defective', 45], ['Changed mind', 20], ['Wrong item', 20], ['Late delivery', 15]])
          : weighted([['Defective', 30], ['Wrong item', 25], ['Changed mind', 25], ['Late delivery', 20]]);
      var rday = om.ship + randInt(2, 14);
      if (rday > lastDay) rday = lastDay;
      var refund = round2(it[3] * it[4] * (1 - it[5] / 100));
      returns.push([rid++, o[0], it[2], iso(rday), reason, refund, chance(0.92) ? 1 : 0]);
    });
    T.returns = returns;

    // departments + employees
    T.departments = DEPARTMENTS.map(function (d) { return d.slice(); });
    var employees = [], eid = 1;
    function emp(name, dept, title, store, mgr, gender, city, hire, exit, salary, rating) {
      var row = [eid, name, dept, title, store, mgr, gender, city, hire, exit, salary, rating];
      employees.push(row); return eid++;
    }
    function pname(g) { return (g === 'F' ? pick(FIRST_F) : pick(FIRST_M)) + ' ' + pick(LAST); }
    function sal(base) { return Math.round(base * (0.9 + rand() * 0.25) / 500) * 500; }
    function hireDate(fromY, toY) { return iso(dn(fromY, 1, 1) + randInt(0, dn(toY, 12, 31) - dn(fromY, 1, 1))); }
    function rating(hire) { return hire >= '2026-01-01' ? null : weighted([[1, 3], [2, 10], [3, 40], [4, 35], [5, 12]]); }
    var storeCity = {}; STORES.forEach(function (s) { storeCity[s[0]] = s[2]; });

    var ceo = emp('Meera Krishnan', 1, 'Chief Executive Officer', null, null, 'F', 'Gurugram', '2018-06-01', null, 850000, 5);
    emp(pname('M'), 1, 'Executive Assistant', null, ceo, 'M', 'Gurugram', '2019-02-11', null, sal(55000), rating('2019-02-11'));
    var heads = {};
    var headDefs = [[2, 'Head of Sales & Store Operations', 'M', 420000], [3, 'Head of Marketing', 'F', 380000], [4, 'Chief Financial Officer', 'M', 450000], [5, 'Head of Human Resources', 'F', 340000], [6, 'Head of Technology & Data', 'M', 440000], [7, 'Head of Supply Chain', 'F', 360000]];
    headDefs.forEach(function (h) {
      var hd = hireDate(2018, 2021);
      heads[h[0]] = emp(pname(h[2]), h[0], h[1], null, ceo, h[2], h[0] === 6 ? 'Bengaluru' : 'Gurugram', hd, null, sal(h[3]), rating(hd));
    });
    // store managers + associates
    physical.forEach(function (s) {
      var g = chance(0.45) ? 'F' : 'M';
      var openIso = s[6];
      var hd = openIso < '2020-01-01' ? hireDate(2019, 2020) : openIso;
      var mgrId;
      if (s[0] === 6) { // Kolkata: a manager left and was replaced
        emp(pname('M'), 2, 'Store Manager', s[0], heads[2], 'M', s[2], hd, '2025-03-31', sal(120000), 2);
        mgrId = emp(pname('F'), 2, 'Store Manager', s[0], heads[2], 'F', s[2], '2025-04-01', null, sal(125000), rating('2025-04-01'));
      } else {
        mgrId = emp(pname(g), 2, 'Store Manager', s[0], heads[2], g, s[2], hd, null, sal(s[5] === 'Flagship' ? 160000 : 115000), rating(hd));
      }
      for (var a = 0; a < 2; a++) {
        var ag = chance(0.5) ? 'F' : 'M';
        var ah = openIso > hd ? openIso : hireDate(Number(hd.slice(0, 4)), 2025);
        if (ah < openIso) ah = openIso;
        var ex = chance(0.22) ? iso(dn.apply(null, ah.split('-').map(Number)) + randInt(120, 900)) : null;
        if (ex && ex > '2026-08-31') ex = null;
        emp(pname(ag), 2, 'Sales Associate', s[0], mgrId, ag, s[2], ah, ex, sal(28000), ex ? weighted([[2, 40], [3, 40], [4, 20]]) : rating(ah));
      }
    });
    // category managers + customer support under sales ops
    ['Category Manager - Electronics', 'Category Manager - Fashion', 'Category Manager - Home & Grocery'].forEach(function (t) {
      var g = chance(0.5) ? 'F' : 'M', hd = hireDate(2020, 2024);
      emp(pname(g), 2, t, null, heads[2], g, 'Gurugram', hd, null, sal(140000), rating(hd));
    });
    var csLead = emp(pname('F'), 2, 'Customer Support Lead', null, heads[2], 'F', 'Gurugram', '2021-05-03', null, sal(75000), 4);
    for (var cs = 0; cs < 4; cs++) { var g1 = chance(0.6) ? 'F' : 'M', h1 = hireDate(2022, 2026); var x1 = chance(0.25) ? iso(dn.apply(null, h1.split('-').map(Number)) + randInt(200, 700)) : null; if (x1 && x1 > '2026-08-31') x1 = null; emp(pname(g1), 2, 'Customer Support Executive', null, csLead, g1, 'Gurugram', h1, x1, sal(32000), x1 ? 3 : rating(h1)); }
    // marketing
    var mm1 = emp(pname('M'), 3, 'Marketing Manager', null, heads[3], 'M', 'Gurugram', '2020-09-14', null, sal(150000), 4);
    ['Digital Marketing Executive', 'Digital Marketing Executive', 'Digital Marketing Executive', 'Brand Executive', 'Marketing Analyst'].forEach(function (t) { var g = chance(0.5) ? 'F' : 'M', hd = hireDate(2021, 2026); var ex = chance(0.2) ? iso(dn.apply(null, hd.split('-').map(Number)) + randInt(300, 800)) : null; if (ex && ex > '2026-08-31') ex = null; emp(pname(g), 3, t, null, mm1, g, 'Gurugram', hd, ex, sal(t === 'Marketing Analyst' ? 70000 : 48000), ex ? 3 : rating(hd)); });
    // finance
    var fm = emp(pname('F'), 4, 'Finance Manager', null, heads[4], 'F', 'Gurugram', '2019-11-04', null, sal(160000), 4);
    ['Accountant', 'Accountant', 'Accountant', 'FP&A Analyst'].forEach(function (t) { var g = chance(0.5) ? 'F' : 'M', hd = hireDate(2020, 2025); emp(pname(g), 4, t, null, fm, g, 'Gurugram', hd, null, sal(t === 'Accountant' ? 52000 : 85000), rating(hd)); });
    // HR
    var hrm = emp(pname('F'), 5, 'HR Manager', null, heads[5], 'F', 'Gurugram', '2020-02-17', null, sal(130000), 4);
    ['HR Executive', 'HR Executive', 'Recruiter'].forEach(function (t) { var g = chance(0.6) ? 'F' : 'M', hd = hireDate(2021, 2026); emp(pname(g), 5, t, null, hrm, g, 'Gurugram', hd, null, sal(45000), rating(hd)); });
    // tech & data
    var em = emp(pname('M'), 6, 'Engineering Manager', null, heads[6], 'M', 'Bengaluru', '2020-07-06', null, sal(260000), 4);
    ['Software Engineer', 'Software Engineer', 'Software Engineer', 'Software Engineer', 'Data Engineer'].forEach(function (t) { var g = chance(0.35) ? 'F' : 'M', hd = hireDate(2021, 2026); var ex = chance(0.25) ? iso(dn.apply(null, hd.split('-').map(Number)) + randInt(300, 900)) : null; if (ex && ex > '2026-08-31') ex = null; emp(pname(g), 6, t, null, em, g, 'Bengaluru', hd, ex, sal(t === 'Data Engineer' ? 150000 : 130000), ex ? weighted([[2, 30], [3, 50], [4, 20]]) : rating(hd)); });
    var am = emp(pname('F'), 6, 'Analytics Manager', null, heads[6], 'F', 'Bengaluru', '2021-03-01', null, sal(220000), 5);
    ['Data Analyst', 'Data Analyst', 'Data Analyst', 'BI Developer'].forEach(function (t) { var g = chance(0.5) ? 'F' : 'M', hd = hireDate(2022, 2026); emp(pname(g), 6, t, null, am, g, 'Bengaluru', hd, null, sal(t === 'BI Developer' ? 110000 : 90000), rating(hd)); });
    // supply chain
    var lm = emp(pname('M'), 7, 'Logistics Manager', null, heads[7], 'M', 'Gurugram', '2019-05-20', null, sal(140000), 3);
    ['Warehouse Supervisor', 'Warehouse Supervisor', 'Procurement Executive', 'Procurement Executive', 'Inventory Analyst'].forEach(function (t) { var g = chance(0.35) ? 'F' : 'M', hd = hireDate(2020, 2026); var ex = chance(0.2) ? iso(dn.apply(null, hd.split('-').map(Number)) + randInt(300, 900)) : null; if (ex && ex > '2026-08-31') ex = null; emp(pname(g), 7, t, null, lm, g, 'Gurugram', hd, ex, sal(t === 'Inventory Analyst' ? 75000 : 45000), ex ? 3 : rating(hd)); });
    T.employees = employees;

    // monthly targets (derived from actual net sales so hits and misses both exist)
    var revByStoreMonth = {};
    orders.forEach(function (o) {
      if (o[6] === 'Cancelled') return;
      var key = o[2] + '|' + o[4].slice(0, 7);
      revByStoreMonth[key] = (revByStoreMonth[key] || 0) + orderMeta[o[0]].subtotal;
    });
    var targets = [];
    STORES.forEach(function (s) {
      months.forEach(function (mm) {
        var monthStart = dn(mm[0], mm[1], 1);
        if (storeOpen[s[0]] > monthStart + daysInMonth(mm[0], mm[1]) - 1) return;
        var key = s[0] + '|' + mm[0] + '-' + pad(mm[1]);
        var actual = revByStoreMonth[key] || 0;
        var tgt = actual > 0 ? actual * (0.85 + rand() * 0.38) : 100000;
        tgt = Math.max(50000, Math.round(tgt / 10000) * 10000);
        targets.push([s[0], mm[0] + '-' + pad(mm[1]), tgt]);
      });
    });
    T.monthly_targets = targets;

    // inventory
    var inv = [];
    STORES.forEach(function (s) {
      var scale = s[5] === 'Online' ? 3 : s[5] === 'Flagship' ? 1.6 : 1;
      prodMeta.forEach(function (pm) {
        var stock = chance(0.07) ? 0 : Math.round(randInt(2, 90) * scale);
        if (!pm.active) stock = chance(0.5) ? 0 : randInt(1, 12);
        var reorder = pm.price > 20000 ? randInt(2, 6) : randInt(8, 30);
        inv.push([s[0], pm.id, stock, reorder, iso(dn(2026, 6, 1) + randInt(0, 91))]);
      });
    });
    T.inventory = inv;

    // web events
    var events = [], evid = 1;
    var evStart = dn(2026, 6, 1), evEnd = dn(2026, 8, 31);
    var custIds = [];
    for (var c2 = 1; c2 <= 500; c2++) if (custIndex[c2].signup <= evStart) custIds.push(c2);
    for (var s2 = 1; s2 <= 1600; s2++) {
      var sid = 'S' + (100000 + s2);
      var day2 = evStart + randInt(0, evEnd - evStart);
      var device = weighted([['Mobile', 62], ['Desktop', 30], ['Tablet', 8]]);
      var cust2 = chance(0.6) ? pick(custIds) : null;
      var hour = weighted([[randInt(0, 6), 5], [randInt(7, 11), 20], [randInt(12, 17), 30], [randInt(18, 23), 45]]);
      var secs = hour * 3600 + randInt(0, 3599);
      var conv = device === 'Mobile' ? 0.85 : device === 'Desktop' ? 1.15 : 1.0;
      var steps = ['page_view', 'product_view', 'add_to_cart', 'checkout', 'purchase'];
      var probs = [1, 0.68, 0.42, 0.62, 0.72];
      for (var st = 0; st < steps.length; st++) {
        if (st > 0 && !chance(Math.min(0.98, probs[st] * conv))) break;
        var ts = iso(day2) + ' ' + pad(Math.floor(secs / 3600) % 24) + ':' + pad(Math.floor(secs / 60) % 60) + ':' + pad(secs % 60);
        events.push([evid++, sid, cust2, ts, steps[st], device]);
        secs += randInt(20, 240);
      }
    }
    T.web_events = events;

    // raw leads (deliberately messy)
    var leads = [], lid = 1;
    var cityVariants = { 'Bengaluru': ['Bengaluru', 'Bangalore', 'bangalore ', 'BLR', 'Bengaluru '], 'Delhi': ['Delhi', 'New Delhi', 'delhi', 'DELHI'], 'Mumbai': ['Mumbai', 'mumbai', 'Bombay', 'Mumbai '], 'Hyderabad': ['Hyderabad', 'hyderabad', 'Hyd'], 'Pune': ['Pune', 'pune', 'PUNE'], 'Dehradun': ['Dehradun', 'Dehra Dun', 'dehradun'] };
    var sources = ['Web Form', 'web form', 'Facebook', 'FB', 'Referral', 'referral', 'Instagram', 'Walk-in', 'Event'];
    var statuses = ['New', 'Contacted', 'Qualified', 'Lost', null];
    function mangleName(n) { var r = rand(); return r < 0.5 ? n : r < 0.65 ? n.toUpperCase() : r < 0.8 ? n.toLowerCase() : r < 0.9 ? '  ' + n : n + ' '; }
    function mangleEmail(e) { var r = rand(); return r < 0.6 ? e : r < 0.75 ? e.toUpperCase() : r < 0.85 ? ' ' + e + ' ' : r < 0.92 ? e.replace('@', '@@') : e.replace('@', ''); }
    function manglePhone(d) { var r = rand(); return r < 0.4 ? '+91 ' + d.slice(0, 5) + ' ' + d.slice(5) : r < 0.6 ? d : r < 0.8 ? '0' + d : r < 0.9 ? d.slice(0, 5) + '-' + d.slice(5) : '+91-' + d; }
    function mangleDate(n) { var p = parts(n), r = rand(); return r < 0.4 ? iso(n) : r < 0.6 ? pad(p.d) + '/' + pad(p.m) + '/' + p.y : r < 0.8 ? pad(p.d) + '-' + MONTH_ABBR[p.m - 1] + '-' + p.y : iso(n) + ' ' + pad(randInt(8, 20)) + ':' + pad(randInt(0, 59)); }
    var baseLeads = [];
    for (var L = 0; L < 128; L++) {
      var lg = chance(0.5) ? 'F' : 'M';
      var lf = lg === 'F' ? pick(FIRST_F) : pick(FIRST_M), ll = pick(LAST);
      var lemail = (lf + '.' + ll).toLowerCase().replace(/[^a-z.]/g, '') + randInt(1, 99) + '@' + weighted(EMAIL_DOMAINS);
      var lphone = '' + randInt(6, 9) + randInt(100000000, 999999999);
      var lcityKey = pick(Object.keys(cityVariants));
      var lday = dn(2026, 5, 1) + randInt(0, 120);
      baseLeads.push({ name: lf + ' ' + ll, email: lemail, phone: lphone, city: lcityKey, day: lday });
    }
    baseLeads.forEach(function (b) {
      var copies = chance(0.15) ? 2 : chance(0.03) ? 3 : 1; // ~22 duplicates
      for (var cpy = 0; cpy < copies; cpy++) {
        var d = b.day + (cpy ? randInt(0, 10) : 0);
        leads.push([lid++, chance(0.03) ? null : mangleName(b.name), chance(0.05) ? null : mangleEmail(b.email), chance(0.08) ? null : manglePhone(b.phone), pick(cityVariants[b.city]), pick(sources), mangleDate(d), pick(statuses)]);
      }
    });
    T.raw_leads = leads;

    // NPS responses
    var delivered = orders.filter(function (o) { return o[6] === 'Delivered' || o[6] === 'Returned'; });
    var returnedOrders = {}; returns.forEach(function (rt) { returnedOrders[rt[1]] = 1; });
    var nps = [], nid = 1, used = {};
    var promoterC = ['Quick delivery and neat packaging.', 'Great prices during the sale.', 'Store staff were very helpful.', 'App is smooth, checkout took a minute.', 'Loved the product quality.', 'Easy exchange process.'];
    var passiveC = ['Fine overall, nothing special.', 'Delivery was okay, a day late.', 'Good product, average packaging.', 'Prices could be better.'];
    var detractorC = ['Delivery was very late.', 'Received a damaged item.', 'Return took too long to process.', 'Customer support did not respond.', 'Wrong item delivered.', 'Product stopped working in a week.'];
    var attempts = 0;
    while (nps.length < 400 && attempts < 5000) {
      attempts++;
      var o = pick(delivered);
      if (used[o[0]]) continue;
      used[o[0]] = 1;
      var om2 = orderMeta[o[0]];
      var shipDelay = om2.ship - om2.day;
      var bad = returnedOrders[o[0]] || shipDelay >= 4;
      var band = bad ? weighted([['P', 15], ['N', 30], ['D', 55]]) : weighted([['P', 50], ['N', 30], ['D', 20]]);
      var score = band === 'P' ? randInt(9, 10) : band === 'N' ? randInt(7, 8) : randInt(0, 6);
      var comment = chance(0.35) ? null : pick(band === 'P' ? promoterC : band === 'N' ? passiveC : detractorC);
      var sday = om2.ship + randInt(5, 20);
      if (sday > lastDay) sday = lastDay;
      nps.push([nid++, o[1], o[0], iso(sday), score, comment]);
    }
    nps.sort(function (a, b) { return a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : a[0] - b[0]; });
    nps.forEach(function (n, i) { n[0] = i + 1; });
    T.nps_responses = nps;

    return T;
  }

  var TABLE_ORDER = ['stores', 'customers', 'products', 'campaigns', 'orders', 'order_items', 'returns', 'departments', 'employees', 'monthly_targets', 'inventory', 'web_events', 'raw_leads', 'nps_responses'];

  /* ---------- the Excel workbook: fixed sheet layouts the whole course refers to ----------
     Every module quotes cell ranges like Sales!P:P, so the column order here is a contract.
     Dates are stored as Excel serial numbers (days since 30 Dec 1899), exactly as Excel does. */

  var EXCEL_EPOCH = dn(1899, 12, 30);
  function serial(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return null;
    return dn(+m[1], +m[2], +m[3]) - EXCEL_EPOCH;
  }

  function buildWorkbook() {
    var T = generate();
    var byId = function (rows, idx) { var o = {}; rows.forEach(function (r) { o[r[idx]] = r; }); return o; };
    var stores = byId(T.stores, 0), customers = byId(T.customers, 0), products = byId(T.products, 0);
    var employees = byId(T.employees, 0), departments = byId(T.departments, 0), orders = byId(T.orders, 0);

    var sheets = [];
    function sheet(name, desc, cols, rows) {
      sheets.push({ name: name, desc: desc, cols: cols, rows: rows });
    }
    var C = function (name, type, doc) { return { name: name, type: type, doc: doc || '' }; };

    /* Sales: one row per order line. The sheet most formulas in the course point at. */
    var orderValue = {};
    var sales = T.order_items.map(function (it) {
      var o = orders[it[1]], p = products[it[2]], s = stores[o[2]], c = customers[o[1]];
      var rev = round2(it[3] * it[4] * (1 - it[5] / 100));
      orderValue[o[0]] = round2((orderValue[o[0]] || 0) + rev);
      return [o[0], serial(o[4]), o[4].slice(0, 7), s[1], s[2], s[4], o[7], c[1], c[8], p[1], p[2], p[3], it[3], it[4], it[5], rev, o[6], o[8]];
    });
    sheet('Sales',
      'One row per order line, January 2024 to August 2026, every order status included. LineRevenue = Qty × UnitPrice × (1 − DiscountPct/100). Region is blank for the online store.',
      [C('OrderID', 'num', 'Order number; repeats when an order has several lines'), C('OrderDate', 'date', 'Date the order was placed'), C('Month', 'text', 'YYYY-MM, handy for SUMIFS and pivots'),
       C('Store', 'text', 'Store name; "Novamart Online" for web and app orders'), C('City', 'text'), C('Region', 'text', 'North / South / East / West; blank for online'),
       C('Channel', 'text', 'Store, Online or App'), C('Customer', 'text', 'Customer name'), C('Segment', 'text', 'Consumer, Corporate or Small Business'),
       C('Product', 'text'), C('Category', 'text', 'Six categories'), C('SubCategory', 'text'), C('Qty', 'num'), C('UnitPrice', 'num', 'INR, price charged on the line'),
       C('DiscountPct', 'num', 'Percent, 0–40'), C('LineRevenue', 'num', 'INR, net of discount, before returns'), C('Status', 'text', 'Delivered, Cancelled, Returned or Processing'), C('Payment', 'text', 'Payment method')],
      sales);

    sheet('Orders',
      'One row per order header (3,000). OrderValue is the sum of that order\'s line revenue.',
      [C('OrderID', 'num'), C('OrderDate', 'date'), C('CustomerID', 'num'), C('StoreID', 'num'), C('CampaignID', 'num', 'Blank when no campaign was attributed'),
       C('Channel', 'text'), C('Status', 'text'), C('Payment', 'text'), C('ShippingFee', 'num'), C('OrderValue', 'num', 'INR, sum of line revenue')],
      T.orders.map(function (o) { return [o[0], serial(o[4]), o[1], o[2], o[3], o[7], o[6], o[8], o[9], orderValue[o[0]] || 0]; }));

    sheet('Products',
      'Catalogue of 72 SKUs across six categories. Four are discontinued (Active = FALSE).',
      [C('ProductID', 'num'), C('Product', 'text'), C('Category', 'text'), C('SubCategory', 'text'), C('Brand', 'text'),
       C('UnitCost', 'num', 'INR, cost to Novamart'), C('ListPrice', 'num', 'INR, shelf price'), C('LaunchDate', 'date'), C('Active', 'bool')],
      T.products.map(function (p) { return [p[0], p[1], p[2], p[3], p[4], p[5], p[6], serial(p[7]), p[8] === 1]; }));

    sheet('Stores',
      'Thirteen stores. StoreID 13 is Novamart Online: Region and SqFt are blank for it.',
      [C('StoreID', 'num'), C('Store', 'text'), C('City', 'text'), C('State', 'text'), C('Region', 'text'), C('Type', 'text', 'Flagship, Standard or Online'), C('Opened', 'date'), C('SqFt', 'num')],
      T.stores.map(function (s) { return [s[0], s[1], s[2], s[3], s[4], s[5], serial(s[6]), s[7]]; }));

    sheet('Customers',
      'Five hundred registered customers. Some emails, phones and birth years are blank on purpose.',
      [C('CustomerID', 'num'), C('Name', 'text'), C('Email', 'text'), C('Phone', 'text'), C('Gender', 'text'), C('BirthYear', 'num'),
       C('City', 'text'), C('State', 'text'), C('Segment', 'text'), C('AcqChannel', 'text', 'How the customer first came to Novamart'), C('SignupDate', 'date'), C('Tier', 'text', 'Bronze / Silver / Gold; blank = not enrolled')],
      T.customers.map(function (c) { return [c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7], c[8], c[9], serial(c[10]), c[11]]; }));

    sheet('Targets',
      'Revenue target per store per month, from each store\'s opening month.',
      [C('StoreID', 'num'), C('Store', 'text'), C('Month', 'text', 'YYYY-MM'), C('Target', 'num', 'INR')],
      T.monthly_targets.map(function (t) { return [t[0], stores[t[0]][1], t[1], t[2]]; }));

    sheet('Employees',
      'Current and former staff (85). ExitDate blank means still employed. Rating blank means no completed review.',
      [C('EmpID', 'num'), C('Name', 'text'), C('Department', 'text'), C('JobTitle', 'text'), C('Store', 'text', 'Blank for head-office roles'), C('City', 'text'),
       C('HireDate', 'date'), C('ExitDate', 'date'), C('MonthlySalary', 'num', 'INR gross'), C('Rating', 'num', '1 (low) to 5 (high)'), C('ManagerID', 'num', 'EmpID of the line manager')],
      T.employees.map(function (e) { return [e[0], e[1], departments[e[2]][1], e[3], e[4] ? stores[e[4]][1] : null, e[7], serial(e[8]), serial(e[9]), e[10], e[11], e[5]]; }));

    sheet('Returns',
      'Product returns (263), including partial returns on orders whose status is still Delivered.',
      [C('ReturnID', 'num'), C('OrderID', 'num'), C('Product', 'text'), C('ReturnDate', 'date'), C('Reason', 'text'), C('Refund', 'num', 'INR'), C('Approved', 'bool')],
      T.returns.map(function (r) { return [r[0], r[1], products[r[2]][1], serial(r[3]), r[4], r[5], r[6] === 1]; }));

    sheet('Campaigns',
      'Ten marketing campaigns with their windows and budgets.',
      [C('CampaignID', 'num'), C('Campaign', 'text'), C('Channel', 'text'), C('Objective', 'text'), C('Start', 'date'), C('End', 'date'), C('Budget', 'num', 'INR')],
      T.campaigns.map(function (c) { return [c[0], c[1], c[2], c[3], serial(c[4]), serial(c[5]), c[6]]; }));

    sheet('Inventory',
      'Stock position per store and product as of 31 Aug 2026 (936 rows).',
      [C('StoreID', 'num'), C('Store', 'text'), C('ProductID', 'num'), C('Product', 'text'), C('StockOnHand', 'num'), C('ReorderLevel', 'num'), C('LastRestock', 'date')],
      T.inventory.map(function (i) { return [i[0], stores[i[0]][1], i[1], products[i[1]][1], i[2], i[3], serial(i[4])]; }));

    sheet('NPS',
      'Post-purchase survey answers (400), score 0–10.',
      [C('ResponseID', 'num'), C('CustomerID', 'num'), C('OrderID', 'num'), C('SurveyDate', 'date'), C('Score', 'num'), C('Comment', 'text')],
      T.nps_responses.map(function (n) { return [n[0], n[1], n[2], serial(n[3]), n[4], n[5]]; }));

    sheet('Leads',
      'A raw export from the website lead form (150 rows). Deliberately messy: duplicates, odd casing, stray spaces, mixed date formats, broken emails. CreatedAt is text, not a date.',
      [C('LeadID', 'num'), C('FullName', 'text'), C('Email', 'text'), C('Phone', 'text'), C('City', 'text'), C('Source', 'text'), C('CreatedAt', 'text', 'Text in several formats'), C('Status', 'text')],
      T.raw_leads.map(function (l) { return l.slice(); }));

    sheet('Departments',
      'Seven departments with annual budgets.',
      [C('DeptID', 'num'), C('Department', 'text'), C('AnnualBudget', 'num', 'INR per year'), C('Location', 'text')],
      T.departments.map(function (d) { return d.slice(); }));

    return { sheets: sheets, asOf: serial('2026-08-31'), tables: T };
  }

  root.NovamartData = { generate: generate, buildWorkbook: buildWorkbook, DOCS: DOCS, TABLE_ORDER: TABLE_ORDER, serial: serial, EXCEL_EPOCH: EXCEL_EPOCH };
})(typeof window !== 'undefined' ? window : globalThis);
