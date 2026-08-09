(function(){
var CATEGORIES = ["Keyboards","Headphones","Backpacks","Drinkware","Apparel","Desk Accessories","Stickers & Decor","Webcams & Audio"];
var ADJ = ["Nimbus","Basecamp","Drift","Anchor","Runway","Northline","Fieldstone","Harbor","Switch","Analog","Lowkey","Overland","Sundial","Quietwork","Longform"];
var NOUN = {
  "Keyboards": ["Mechanical Keyboard","Compact Keyboard","Split Keyboard","Wireless Keypad"],
  "Headphones": ["Over-Ear Headphones","Noise-Cancelling Buds","Studio Headset","Travel Earbuds"],
  "Backpacks": ["Commuter Backpack","Laptop Sling","Weekender Pack","Tech Tote"],
  "Drinkware": ["Insulated Mug","Travel Tumbler","Ceramic Cup","Water Bottle"],
  "Apparel": ["Zip Hoodie","Crewneck Sweatshirt","Graphic Tee","Beanie"],
  "Desk Accessories": ["Monitor Stand","Desk Mat","Cable Organizer","Phone Dock"],
  "Stickers & Decor": ["Sticker Pack","Vinyl Decal Set","Enamel Pin Set","Desk Print"],
  "Webcams & Audio": ["HD Webcam","USB Microphone","Ring Light","Podcast Mic Arm"]
};
var COLORS = ["Charcoal","Sand","Rust Orange","Slate Blue","Off-White","Forest"];
var SIZES = ["S","M","L","XL"];
function seededPrice(i){ return Math.round((19 + (i * 7 % 140) + (i % 3) * 4.5) * 100) / 100; }

var PRODUCTS = [];
var id = 1;
CATEGORIES.forEach(function(cat, ci){
  NOUN[cat].forEach(function(noun, ni){
    for (var v = 0; v < 2; v++) {
      var adj = ADJ[(ci * 4 + ni * 2 + v) % ADJ.length];
      var name = adj + " " + noun;
      var hasSize = cat === "Apparel";
      PRODUCTS.push({
        id: id,
        name: name,
        category: cat,
        price: seededPrice(id),
        rating: 3.5 + ((id * 3) % 15) / 10,
        reviews: 8 + (id * 17) % 240,
        colors: COLORS.slice((id % 3), (id % 3) + 3),
        sizes: hasSize ? SIZES : null,
        blurb: adj + " take on the everyday " + noun.toLowerCase() + ", designed for people who spend their day at a keyboard running tests.",
        tags: id % 5 === 0 ? ["New"] : (id % 7 === 0 ? ["Best Seller"] : []),
        imageThumb: "assets/products/p" + id + "-thumb.webp",
        imageCard: "assets/products/p" + id + "-card.jpg",
        imageDetail: "assets/products/p" + id + "-detail.png"
      });
      id++;
    }
  });
});

var CATEGORY_SLUG = {
  "Keyboards": "keyboards",
  "Headphones": "headphones",
  "Backpacks": "backpacks",
  "Drinkware": "drinkware",
  "Apparel": "apparel",
  "Desk Accessories": "desk-accessories",
  "Webcams & Audio": "webcams-audio"
};
function categoryImage(cat) {
  var slug = CATEGORY_SLUG[cat];
  return slug ? "assets/categories/" + slug + ".jpg" : null;
}

window.__wdioProducts = PRODUCTS;
window.__wdioCategoryImage = categoryImage;
})();
