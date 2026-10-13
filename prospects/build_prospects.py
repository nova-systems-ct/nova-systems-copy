"""Builds the Nova prospect workbook and CRM CSVs from researched, sourced records.

    python -I prospects/build_prospects.py

Every record below was checked on 2026-10-13 against public sources (URLs in each row).
Verification rule: the business phone appears on the business's own website, OR two independent
public directories agree. Anything weaker is on the "Needs verification" sheet and in no call list.
No record was invented. Decision-maker names appear only where the business's own website names them.
A published phone number is NOT consent to text or email, and nothing here has been DNC-screened.
"""
import csv, os, zipfile, datetime
from xml.sax.saxutils import escape

HERE = os.path.dirname(os.path.abspath(__file__))
VERIFIED_ON = "2026-10-13"

WBY = "https://web.waterburychamber.com/atlas/directory/category/"
SO = "https://www.southingtonchamber.com/business/"
BBB = "https://www.bbb.org/us/ct/waterbury/category/"
CH = {
    "clean": WBY + "business-&-professional-services---cleaning-services",
    "plumb": WBY + "business-&-professional-services---plumbing-&-heating",
    "sec": WBY + "business-&-professional-services---security-systems-&-services",
    "ext": WBY + "home-&-garden---exterminators",
    "pest": WBY + "home-&-garden---pest-control",
    "garage": WBY + "home-&-garden---garage-door-specialists",
    "hic": WBY + "home-&-garden---home-improvement-contractors",
    "lawn": WBY + "home-&-garden---lawn-maintenance-fertilization-&-irrigation",
    "mech": WBY + "industrial-&-manufacturing---mechanical-contractors",
    "elec": WBY + "real-estate-&-construction---electrical-contractors",
    "paving": WBY + "real-estate-&-construction---paving",
    "oil": WBY + "public-utilities-&-environment---oil",
    "solar": WBY + "public-utilities-&-environment---solar-&-smart-homes",
    "photo": WBY + "advertising-&-media---photographers",
    "events": WBY + "arts,-culture-&-entertainment---events",
    "banquet": WBY + "family,-community-&-non-profit---banquet-facilities",
    "pet": WBY + "other---pet-care",
    "design": WBY + "home-&-garden---design-services",
    "dance": WBY + "arts,-culture-&-entertainment---dance-studio",
    "auto": WBY + "automotive,-aviation-&-marine---automobile-repairs",
    "beauty": WBY + "personal-services-&-care---beauty-salons",
    "florist": WBY + "shopping-&-specialty-retail---florists-&-floral-designers",
}
NO_CONSENT = "Not screened against National DNC or any internal suppression list. Published number is not SMS/email consent. Screen before any call."
NONAME = ""

# Industry-level fit and opener. Openers ask; they never assert a problem the evidence has not shown.
FIT = {
    "HVAC": ("Service calls arrive by phone and web form at all hours; work is scheduled and often quoted before it starts.",
             "When a heating call or quote request comes in after hours or while everyone is on a job, what happens to it until someone can get back to the customer?"),
    "plumbing": ("Urgent and planned plumbing requests arrive by phone and forms; jobs are scheduled and estimated.",
                 "When a customer calls or fills in the form while your team is on a job, how does that request get answered and booked?"),
    "electrical": ("Estimate requests and service calls need a reply, a scheduled visit and sometimes a diagnostic fee explained up front.",
                   "How do estimate requests that come in through the website get answered and put on the schedule today?"),
    "cleaning": ("Recurring and one-time cleanings are quoted and scheduled; customers compare several companies quickly.",
                 "When someone asks for a cleaning quote, how quickly can they usually get a price and a date from you?"),
    "pest": ("Pest calls are time-sensitive; inspections and recurring plans are scheduled and quoted.",
             "When a customer calls about a pest problem after hours, how does that call get handled until the morning?"),
    "garage doors": ("Repair calls are urgent and installs are quoted; customers usually call the first company that answers.",
                     "When a repair call comes in while your technicians are out, how does it get answered and scheduled?"),
    "roofing": ("Estimates and inspections are scheduled from phone and web requests; projects often involve agreements and deposits.",
                "How do roof estimate requests get followed up after the first call, especially during the busy season?"),
    "landscaping": ("Seasonal estimates, recurring maintenance and cleanups are scheduled from calls and forms.",
                    "In your busy season, how do new estimate requests get answered and booked while crews are out?"),
    "paving": ("Estimates and seasonal booking (sealcoating, paving) depend on fast follow-up and a scheduled site visit.",
               "When you are out on a job, how do new estimate requests get answered and put on the calendar?"),
    "heating oil": ("Delivery and heating service requests arrive by phone and form; new-customer sign-up involves paperwork.",
                    "How do new customers sign up for delivery or service today, and how long does that take from first call?"),
    "solar/roofing": ("Consultations are booked from inquiries; follow-up and scheduling drive whether a consultation happens.",
                      "After someone asks for a free consultation, what are the steps until they are on your calendar?"),
    "photography": ("Sessions are inquired about, booked for a date, and usually secured with a retainer and agreement.",
                    "When someone asks about a session, what are the steps from their first message to a booked date with a retainer?"),
    "event production": ("Event inquiries need a quick reply, a date hold, an agreement and a deposit.",
                         "How do event inquiries move from first message to a signed agreement and deposit today?"),
    "venue": ("Venues run on inquiries, tours, date holds, contracts and deposits.",
              "When a couple or planner asks about a date, what happens between their inquiry and a booked tour?"),
    "pet boarding": ("Boarding and daycare are booked by date, with first-visit requirements and peak-holiday demand.",
                     "Around holidays, how do boarding requests get answered and confirmed when the phones are busy?"),
    "home improvement": ("Projects start from consultations booked from inquiries; follow-up drives whether they become jobs.",
                         "How do consultation requests from the website get followed up and booked today?"),
    "security systems": ("Quotes and installations are scheduled from inquiries; response speed matters for a sale.",
                         "When someone requests a quote through your site, how do they hear back and get scheduled?"),
    "junk removal": ("Same-day and next-day jobs depend on answering quickly, quoting and slotting the job.",
                     "When several requests come in at once, how do you keep each one answered and scheduled?"),
    "painting": ("Estimates are scheduled from inquiries; projects are quoted and booked weeks ahead.",
                 "How do estimate requests get scheduled today when the crew is out on jobs?"),
    "power washing": ("Quotes from photos and scheduling around weather depend on quick replies.",
                      "When estimate requests come in during a busy week, how do they get answered and scheduled?"),
    "banquet": ("Event inquiries, tours, date holds, agreements and deposits.",
                "When someone asks about availability for a date, what happens between that inquiry and a tour?"),
}

def P(name, industry, phone, town, address, website, sources, method, fit_key, observation="", dm="", dm_src="", lst="", note=""):
    fit, opener = FIT[fit_key]
    if observation:
        opener = opener + " (If relevant: mention you noticed something on their public listing and ask, do not tell.)"
    return dict(business_name=name, industry=industry, phone=phone, town=town, address=address, website=website,
                decision_maker=dm, decision_maker_source=dm_src, source_urls=" | ".join(sources), verification=method,
                verified_on=VERIFIED_ON, fit_rationale=fit, public_observation=observation, opener=opener,
                assigned_list=lst, outreach_status="Not contacted", next_action="Owner approves list and caller; screen against DNC/suppression; then first call during business hours",
                suppression_status=NO_CONSENT, notes=note)

SITE = "Phone shown on the business's own website (matches chamber listing)"
SITE_ONLY = "Phone shown on the business's own website"
SITE_DIFF = "Phone taken from the business's own website (chamber listing shows a different number)"
TWO_DIR = "Two independent directory listings agree (no website check)"

# ---------- List A: Waterbury, Prospect, Wolcott, Watertown/Oakville ----------
A = [
    P("GreenCore, LLC", "Commercial cleaning", "(833) 347-3362", "Waterbury", "20 East Main Street, Waterbury, CT 06702", "https://greencorecleaning.com/", [CH["clean"], "https://greencorecleaning.com/"], SITE, "cleaning", "Website does not list business hours."),
    P("Just In Time Cleaning LLC", "Residential/commercial cleaning", "(203) 768-1058", "Waterbury", "", "https://justintime-cleaning.com/", [CH["clean"], "https://justintime-cleaning.com/"], SITE, "cleaning", "Website asks customers to call or email to schedule; no request form described."),
    P("C & H Electric, Inc.", "Electrical contractor", "(203) 754-3231", "Waterbury", "1999 South Main Street, Waterbury, CT 06706", "https://chelectric.com/", [CH["elec"], BBB + "electrician", "https://chelectric.com/"], SITE, "electrical"),
    P("Andy's Oil Service, Inc.", "Heating oil and heating service", "(203) 756-8969", "Waterbury", "329 Walnut Street, Waterbury, CT 06704", "https://andysoilservice.com/", [CH["oil"], "https://andysoilservice.com/"], SITE, "heating oil", "New-customer service plan and credit application are downloadable forms."),
    P("Uniquely Yours Photography LLC", "Photography", "(203) 596-7226", "Waterbury", "", "https://uniquelyyoursphoto.com/", [CH["photo"], "https://uniquelyyoursphoto.com/"], SITE, "photography", "Website shows no online booking or retainer information."),
    P("La Bella Vista", "Wedding and event venue", "(203) 527-4006", "Waterbury", "380 Farmwood Road, Waterbury, CT 06704", "https://labellavistaweddings.com/", [CH["banquet"], "https://labellavistaweddings.com/"], SITE, "venue"),
    P("M.J. Fahy & Sons, Inc.", "Plumbing, HVAC, fire protection", "(203) 574-4808", "Waterbury", "20 Judd Street, Waterbury, CT 06702", "https://mjfahy.com/", [CH["plumb"], BBB + "plumber", "https://mjfahy.com/"], SITE, "plumbing", "", note="Long-established, larger firm (since 1890) - lower priority."),
    P("Jacovino's Lawn Care LLC", "Landscaping", "(203) 758-7814", "Prospect", "92 Cheshire Road, Suite 2, Prospect, CT 06712", "https://jacovinoslawncare.bandzoogle.com/", ["https://jacovinoslawncare.bandzoogle.com/contact-us", "https://jacovinoslawncare.bandzoogle.com/home"], SITE_ONLY, "landscaping", "Phone number appears on the contact page but not on the home page."),
    P("MDJ Electric, LLC", "Electrical contractor", "(203) 723-3902", "Prospect", "", "https://mdjelectric.com/", [CH["elec"], "https://mdjelectric.com/"], SITE, "electrical", "", "Brian Pugliese", "Owner and electrician (company website)"),
    P("Aria Wedding and Banquet Facility", "Wedding and banquet venue", "(203) 758-0096", "Prospect", "45 Murphy Road, Prospect, CT 06712", "https://ariaweddingsandevents.com/", [CH["banquet"], "https://ariaweddingsandevents.com/"], SITE, "venue"),
    P("Accurate Electrical Contractors LLC", "Electrical contractor", "(203) 509-7027", "Prospect", "123 Union City Road, Prospect, CT 06712", "", [BBB + "electrician", "https://evtech.news/ev-companies-usa/accurate-electrical-contractors-prospect-united-states.html", "https://www.yellowpages.com/prospect-ct/electric-generators"], TWO_DIR, "electrical", "No company website found."),
    P("Dependable Energy, Inc.", "Heating oil and HVAC", "(203) 758-5831", "Prospect", "9 Gramar Avenue, Prospect, CT 06712", "", [BBB + "heating-and-air-conditioning", "https://www.buildzoom.com/contractor/dependable-energy"], TWO_DIR, "heating oil"),
    P("CEO Services / Tick Busters", "Lawn care and tick control", "(203) 879-1315", "Wolcott", "27 Nutmeg Valley Road, Wolcott, CT 06716", "https://ceoservicesllcct.com/", [CH["lawn"], BBB + "landscape-contractors", "https://ceoservicesllcct.com/"], SITE, "landscaping", "Website lists phone and email; no request form described."),
    P("Millette Pest Control", "Pest control", "(860) 274-9503", "Watertown", "69 Knight Street, Watertown, CT 06795", "https://www.millettepestcontrol.com/", [CH["ext"], "https://www.millettepestcontrol.com/"], SITE, "pest"),
    P("Delmar Electrical Contractors, LLC", "Electrical contractor", "(860) 945-9997", "Oakville", "35 McLennan Drive, Oakville, CT 06779", "https://delmarelectrical.com/", [CH["elec"], "https://delmarelectrical.com/"], SITE, "electrical", "Home page lists phone and email but no request process."),
    P("Baribault Oil Co, Inc.", "Heating oil", "(860) 274-3284", "Oakville", "600 Main Street, Oakville, CT 06779", "https://baribaultfuel.com/", [CH["oil"], "https://baribaultfuel.com/"], SITE, "heating oil", "", "John Santopietro; Sue Santopietro", "Co-owners (company website)", note="Website says calls go to an owner with no answering service or automation - lead with the Audit only and respect that choice."),
    P("The Grand Oak Villa", "Banquet and wedding venue", "(860) 945-0548", "Oakville", "550 Sylvan Lake Road, Oakville, CT 06779", "https://thegrandoakvilla.com/", [CH["banquet"], "https://thegrandoakvilla.com/"], SITE, "venue"),
]
# ---------- List B: Southington, Plantsville, Milldale, Marion, Berlin, Wallingford ----------
B = [
    P("Masotti Electric, LLC", "Electrical contractor", "(860) 276-0097", "Southington", "120 Industrial Drive, Southington, CT 06489", "", [SO + "masotti-electric/", BBB + "electrician"], TWO_DIR, "electrical", "The website listed in the chamber directory (masottielectric.com) currently redirects to an unrelated site."),
    P("Moore Chore Cleaning LLC", "Cleaning", "(860) 877-5660", "Southington", "", "", [SO + "moore-chore-cleaning-llc/", BBB + "house-cleaning"], TWO_DIR, "cleaning", "The website listed in the chamber directory (moorechorecleaning.com) did not resolve when checked."),
    P("Total Pest Control, LLC", "Pest control", "(860) 577-0400", "Southington", "", "https://totalpestcontrolct.com/", [SO + "total-pest-control-llc/", BBB + "pest-control", "https://totalpestcontrolct.com/"], SITE, "pest", "The phone link in the website header dials a different number (860-385-8485) from the number displayed (860-577-0400).", "Mark Hayden; Lisa Hayden", "Owners (company website)"),
    P("Air Temp Mechanical Services", "HVAC", "(860) 953-8888", "Berlin", "63 Fuller Way, Berlin, CT 06037", "https://www.ctairtemp.com/", [SO + "air-temp-mechanical-services/", "https://www.ctairtemp.com/"], SITE, "HVAC", "Website address is Berlin; chamber listing shows a Southington address.", "Jeff Leone", "CEO (company website)"),
    P("Ductworks HVAC Services", "HVAC", "(860) 621-6295", "Southington", "175 Spring Street, Southington, CT 06489", "https://www.ductworkshvac.com/", [SO + "ductworks-hvac-services/", "https://www.ductworkshvac.com/"], SITE, "HVAC", "", note="Already has online scheduling and on-the-way texts per reviews - lower priority."),
    P("Honest Air LLC", "HVAC", "(860) 579-1100", "Southington", "", "https://honestairct.com/", [SO + "honest-air-llc/", "https://honestairct.com/"], SITE_DIFF, "HVAC", "The website's Schedule button links to a '#FreeDemo' section of the home page."),
    P("Thermal Works CT", "HVAC and plumbing", "(860) 919-2767", "Southington", "658 Andrews Street, Southington, CT 06489", "https://www.thermalworksct.com/", [SO + "thermal-works-ct/", "https://www.thermalworksct.com/"], SITE, "HVAC", "", "Matthew Kowal", "Founder (company website)"),
    P("Beacon Electric, Inc.", "Electrical contractor", "(860) 621-3818", "Milldale", "298 Clark Street, Milldale, CT 06467", "https://www.beaconelec.com/", [SO + "beacon-electric-inc/", "https://www.beaconelec.com/"], SITE, "electrical", "Website lists a phone number only; no request form."),
    P("Johnny Junk It", "Junk removal and dumpsters", "(860) 770-8354", "Marion", "2223 Meriden-Waterbury Road, Marion, CT", "https://johnnyjunkit.com/", [SO + "johnny-junk-it/", "https://johnnyjunkit.com/"], SITE, "junk removal"),
    P("Junk Bear LLC", "Junk removal", "(860) 385-6068", "Southington", "", "https://www.junk-bear.com/", [SO + "junk-bear-llc/", "https://www.junk-bear.com/"], SITE_DIFF, "junk removal", "", "Rob Paradis", "Founder (company website)", note="Already offers online booking - lower priority."),
    P("Southington Painting Company, LLC", "Painting", "(860) 628-8923", "Plantsville", "140 Norton Street, Plantsville, CT 06479", "https://www.southingtonpainting.com/", [SO + "southington-painting-co-llc/", "https://www.southingtonpainting.com/"], SITE_DIFF, "painting"),
    P("Asphalt #1 Paving, LLC", "Paving and sealcoating", "(860) 276-1130", "Marion", "", "https://www.asphalt1llc.com/", [SO + "asphalt-1-paving-llc/", "https://www.asphalt1llc.com/"], SITE, "paving", "", "John (first name only)", "Owner (company website)", note="Website promises every call is answered by a live person - ask about after-hours web inquiries only."),
    P("PALS Power Washing, LLC", "Power washing", "(860) 919-8748", "Southington", "", "https://www.palspowerwashing.com/", [SO + "pals-power-washing-llc/", "https://www.palspowerwashing.com/"], SITE, "power washing", "", "Kevin (first name only)", "Owner (company website)"),
    P("Testa's Weddings & Events", "Banquet facility", "(860) 628-8509", "Southington", "26 South Center Street, Southington, CT 06489", "https://www.testas.net/", [SO + "testas-banquet-facility/", "https://www.testas.net/"], SITE, "banquet"),
    P("Saucier Mechanical Services, Inc.", "HVAC and mechanical", "(860) 628-9999", "Plantsville", "148 Norton Street, Plantsville, CT 06479", "", [BBB + "heating-and-air-conditioning", "https://www.trane.com/residential/en/dealers/saucier-mechanical-services-inc-plantsville-ct"], TWO_DIR, "HVAC"),
    P("Patriot Pest Solutions, LLC", "Pest control", "(203) 949-9989", "Wallingford", "324 Main Street, Wallingford, CT 06492", "https://patriotpestsolutions.com/", [CH["pest"], BBB + "pest-control", "https://patriotpestsolutions.com/"], SITE, "pest"),
    P("Nurse's Touch Cleaning Service, LLC", "Cleaning", "(203) 808-1902", "Milldale", "", "https://nursestouchcleaning.com/", [CH["clean"], "https://nursestouchcleaning.com/"], SITE, "cleaning", "Website shows a phone button and email sign-up; no quote form described."),
]
# ---------- List C: Naugatuck, Beacon Falls, Middlebury, Southbury, Oxford ----------
C = [
    P("Luso Cleaning Service, LLC", "Cleaning", "(203) 729-0072", "Naugatuck", "373 Platts Mill Road, Naugatuck, CT 06770", "https://lusocleaningservice.com/", [CH["clean"], "https://lusocleaningservice.com/"], SITE, "cleaning", "Website copyright reads 2003-2018, and the free-estimate sentence is missing a word ('Call or ___ for free estimates')."),
    P("Clean Suites, LLC", "Cleaning", "(203) 482-6884", "Naugatuck", "67 Heritage Drive, Naugatuck, CT 06770", "", [CH["clean"], BBB + "house-cleaning"], TWO_DIR, "cleaning", "No website listed."),
    P("Rhino Garage Doors", "Garage doors", "(860) 450-6173", "Naugatuck", "14 Scott Street, Naugatuck, CT 06770", "https://rhinogaragedoorsct.com/", [CH["garage"], SO + "rhino-garage-doors/", "https://rhinogaragedoorsct.com/"], SITE, "garage doors", "", note="Also lists (203) 592-8340 for southern CT."),
    P("CT Pest Solutions", "Pest and wildlife control", "(203) 903-1645", "Naugatuck", "8 Curtiss Court, Naugatuck, CT 06770", "https://ctpestsolutions.com/", [CH["pest"], BBB + "pest-control", "https://ctpestsolutions.com/"], SITE, "pest", "", note="Already offers online ordering and call/text - lower priority."),
    P("Skyeye Technologies", "Security systems", "(203) 496-8726", "Naugatuck", "", "https://skyeyetech.net/", [CH["sec"], "https://skyeyetech.net/"], SITE_DIFF, "security systems"),
    P("High Rock Water & Mechanical Service", "Well water and plumbing", "(203) 490-6607", "Naugatuck", "65 Hoadley Street, Naugatuck, CT 06770", "https://wellwaterservicect.net/", [CH["plumb"], "https://wellwaterservicect.net/"], SITE, "plumbing", "Website header says 8-5 Monday-Friday while the footer says open 24 hours; after-hours requests go to voicemail, text or form.", "Garrett Lea", "Founder (company website)"),
    P("DiGiorgi Roofing and Siding", "Roofing and siding", "(203) 723-6880", "Beacon Falls", "33 Lancaster Drive, Beacon Falls, CT 06403", "https://digiorgiinc.com/", [CH["hic"], BBB + "garage-doors", "https://digiorgiinc.com/"], SITE, "roofing", "Website 'Book Now' button leads to the contact page rather than a calendar."),
    P("MY Productions CT LLC", "Event production", "(203) 808-1834", "Beacon Falls", "", "https://myproductionsct.com/", [CH["events"], "https://myproductionsct.com/"], SITE, "event production"),
    P("Middlebury Mechanical LLC", "HVAC and plumbing", "(203) 725-4757", "Middlebury", "141 Three Mile Hill Road, Middlebury, CT 06762", "https://middleburymechanical.com/", [CH["plumb"], "https://middleburymechanical.com/"], SITE, "HVAC", "Website 'Book Now' buttons lead to a quote form rather than a calendar."),
    P("Right Way Energy Group", "Solar and roofing", "(203) 788-4906", "Middlebury", "", "https://rightwayenergygroup.com/", [CH["solar"], "https://rightwayenergygroup.com/"], SITE, "solar/roofing", "", "Mark Rebb", "President (company website blog)"),
    P("Wiggles Pet Resort - Middlebury", "Pet boarding and daycare", "(860) 980-1411", "Middlebury", "1082 Southford Road, Middlebury, CT 06762", "https://wigglespetresort.com/", [CH["pet"], "https://wigglespetresort.com/"], SITE_DIFF, "pet boarding", "", "Laura Laaman; Craig Laaman", "Family owners (company website; titles not stated)", note="Three locations (NY and CT)."),
    P("S & S Asphalt Paving Inc", "Paving", "(203) 264-2954", "Southbury", "", "https://sandsasphaltpaving.com/", [CH["paving"], "https://sandsasphaltpaving.com/"], SITE, "paving", "", "Don Stitt; Kevin Starchak", "Owners (company website)"),
    P("Our House LLC", "Home improvement and design", "(203) 794-0304", "Southbury", "77 Main Street North, Unit 101, Southbury, CT 06488", "https://ourhousellc.com/", [CH["design"], "https://ourhousellc.com/"], SITE, "home improvement", "", note="Already offers online booking - lower priority."),
    P("Ward Heating and Cooling LLC", "HVAC", "(203) 994-6052", "Oxford", "30 Macintosh Drive, Oxford, CT 06478", "https://wardheatingandcoolingct.com/", [CH["mech"], "https://wardheatingandcoolingct.com/"], SITE, "HVAC", "", note="Already offers online scheduling - lower priority."),
]
for lst, rows in (("A - Isaac", A), ("B - Salesperson 1", B), ("C - Salesperson 2", C)):
    for r in rows: r["assigned_list"] = lst

# ---------- List D: walk-in (public storefronts with sourced hours) ----------
def W(name, industry, phone, address, town, group, website, hours, hours_src, window, intro, purpose, sources, method, observation="", note=""):
    return dict(business_name=name, industry=industry, phone=phone, address=address, town=town, geo_group=group, website=website,
                hours=hours, hours_source=hours_src, visit_window=window, introduction=intro, purpose=purpose,
                source_urls=" | ".join(sources), verification=method, verified_on=VERIFIED_ON, public_observation=observation,
                assigned_list="D - Isaac walk-in", appointment="None arranged", outreach_status="Not visited",
                next_action="Owner approves visit list; confirm hours by checking the source again the day before",
                suppression_status=NO_CONSENT, notes=note)

INTRO = "Hi, I'm Isaac with Nova Systems here in Waterbury. I won't take more than a minute - is the owner or manager in? If not, may I leave a card?"
D = [
    W("O'Rourke & Birch Florist, Inc.", "Florist", "(203) 756-7857", "One Chase Avenue, Waterbury, CT 06704", "Waterbury", "1 - Waterbury", "", "Mon-Fri 9-5; Sat 9-1; Sun closed", "Patch article, 20 Jan 2023 (dated - confirm)", "Tue-Thu 10:00-11:30; avoid Valentine's and Mother's Day weeks and Saturdays", INTRO, "Introduce Nova and leave a card; ask how wedding and event inquiries are handled today.", [CH["florist"], "https://patch.com/connecticut/naugatuck/orourke-birch-florist-has-new-location"], "Chamber listing (phone + address); hours from a 2023 news article"),
    W("Harmony Dance Center", "Dance studio", "(203) 527-4554", "50 Store Avenue, Unit L, Waterbury, CT 06705", "Waterbury", "1 - Waterbury", "https://harmonydancecenter.net/", "Mon 5-8:15pm; Tue 5:30-8:45pm; Wed 4:30-8pm; Thu 5-8pm; Sat 10am-1:30pm; Fri/Sun by appointment", "Company website", "Wed 4:30-4:45pm, before the first class; keep under 2 minutes", INTRO, "Leave a card; ask how free-trial requests from families are answered and scheduled.", [CH["dance"], "https://harmonydancecenter.net/"], SITE, "Free-trial requests are by 'contact us'; no online registration listed."),
    W("Debbie's Dog Grooming", "Pet grooming", "(203) 753-1152", "575 Meriden Road, Waterbury, CT 06705", "Waterbury", "1 - Waterbury", "", "Mon, Tue, Thu-Sat 8am-3pm; Wed and Sun closed", "threebestrated.com directory (not the business's own site - confirm)", "Tue or Thu 10:30-11:30, between drop-off and pick-up; leave a card if busy", INTRO, "Leave a card; ask how appointment requests and reminders are handled.", ["https://threebestrated.com/pet-grooming-in-waterbury-ct", "https://www.dogdog.org/pet-groomer/d/19"], TWO_DIR, "No business website found."),
    W("Mezzio Auto Care", "Auto repair", "(203) 729-5988", "792 New Haven Road, Naugatuck, CT 06770", "Naugatuck", "2 - Naugatuck", "https://mezzioauto.com/", "Mon-Fri 8am-5pm; Sat 8am-1pm (emissions walk-ins only)", "Company website", "Tue-Thu 10:00-11:30; avoid 8am drop-off and 4-5pm pick-up", INTRO, "Leave a card; ask how after-hours booking requests are confirmed.", [CH["auto"], "https://mezzioauto.com/"], SITE, "", "Website also lists (203) 490-3093; already offers online booking - lower priority."),
    W("Rich's Car Works", "Auto repair", "(203) 720-1447", "27 South Main Street, Naugatuck, CT 06770", "Naugatuck", "2 - Naugatuck", "https://richscarworks.com/", "Mon-Tue 8:30-5:30; Wed 8:30-4:30; Thu 8:30-5:30; Fri-Sun not listed", "Company website", "Tue or Thu 10:00-11:30", INTRO, "Leave a card; ask how appointment requests from the website are confirmed.", [CH["auto"], "https://richscarworks.com/"], SITE, "Website does not list Friday hours."),
    W("DaSilva Auto Body", "Auto body", "(203) 729-5967", "275 Rubber Avenue, Naugatuck, CT 06770", "Naugatuck", "2 - Naugatuck", "https://dasilvaautobody.com/", "Mon-Fri 8:30am-5pm; weekends by appointment", "Company website", "Tue-Thu 10:00-11:30", INTRO, "Leave a card; ask how estimate requests are scheduled.", [CH["auto"], "https://dasilvaautobody.com/"], SITE, "Website 'Schedule an Appointment' button leads to the contact page."),
    W("Terri's Flower Shop", "Florist", "(203) 729-2249", "174 Church Street, Naugatuck, CT 06770", "Naugatuck", "2 - Naugatuck", "https://terrisflowershop.com/", "Mon-Fri 9:30am-5:30pm; Sat 10am-2pm; Sun closed (site notes hours occasionally vary)", "Company website", "Tue-Thu 10:30-12:00; avoid holiday weeks", INTRO, "Leave a card; ask how wedding and event flower inquiries are followed up.", [CH["florist"], "https://terrisflowershop.com/"], SITE),
    W("Nicole Marie Salon", "Hair salon", "(203) 994-4113", "1255 Middlebury Road, Unit 2-2, Middlebury, CT 06762", "Middlebury", "3 - Middlebury/Southbury", "https://nicolemaries.glossgenius.com/", "Wed 11am-7pm; Thu 9am-7pm; Fri 8am-5pm; Sat 8am-4pm; Sun-Tue closed", "Business's online booking page", "Wed 11:00-11:30 at opening; never Saturday", INTRO, "Leave a card; ask how no-shows and rebooking are handled.", [CH["beauty"], "https://nicolemaries.glossgenius.com/"], "Chamber listing (phone); address and hours on the business's booking page", "", "Already uses online booking - lower priority."),
    W("Southbury Country Florist", "Florist", "(203) 264-5527", "200 Main Street South, Southbury, CT 06488", "Southbury", "3 - Middlebury/Southbury", "https://southburycountryflorist.com/", "Mon 9-4; Tue closed; Wed 9-4; Thu 10-2; Fri 9-5:30; Sat 10-2; Sun closed", "Company website", "Wed 10:00-11:30", INTRO, "Leave a card; ask how wedding consultations are booked.", [CH["florist"], "https://southburycountryflorist.com/"], SITE),
    W("Sullivan Brothers Remodeling (showroom)", "Remodeling showroom", "(203) 879-4555", "1 Wolcott Road, Wolcott, CT 06716", "Wolcott", "4 - Wolcott/Southington", "https://sullivan-brothers.com/", "Showroom Mon-Fri 8am-5pm; Saturday and evenings by appointment", "Company website (contact page)", "Tue-Thu 9:30-11:00", INTRO, "Leave a card; ask how consultation requests from the website are followed up.", [CH["hic"], "https://sullivan-brothers.com/about/ContactUs.aspx"], SITE, "Home page shows no phone number; it appears on the contact page."),
    W("Ali's Nurseries & Landscaping", "Garden center and landscaping", "(860) 621-6506", "421 Buckland Street, Plantsville, CT 06479", "Plantsville", "4 - Wolcott/Southington", "https://alisnursery.com/", "Mon-Fri 7am-5pm; Sat 7am-4pm; Sun 7am-3pm (site says seasonal hours change)", "Company website", "Weekday 9:30-11:00; avoid spring weekends", INTRO, "Leave a card; ask how landscaping design requests are followed up.", [SO + "alis-nursery-landscaping/", "https://alisnursery.com/"], SITE),
    W("L&S Automotive", "Used cars and auto repair", "(860) 621-7372", "1157 Meriden-Waterbury Turnpike, Plantsville, CT 06479", "Plantsville", "4 - Wolcott/Southington", "https://www.l-sauto.com/", "Service Mon-Fri 8am-5pm; Sales Mon-Fri 9am-6pm, Sat 9am-3pm", "Company website", "Tue-Thu 10:00-11:30", INTRO, "Leave a card; ask how service appointment requests are confirmed.", [SO + "ls-automotive/", "https://www.l-sauto.com/"], SITE, "", "Service line (860) 426-1794."),
]

NEEDS = [
    ("Suzanne Clerkin Photography", "Southbury", "(203) 232-0561", "Chamber listing only; website shows no phone", CH["photo"]),
    ("Shelley Rinaldi Interiors LLC", "Watertown", "(203) 910-1240", "Chamber listing only; website shows no phone", CH["design"]),
    ("Sullivan Brothers Remodeling (as cold-call)", "Wolcott", "(203) 879-4555", "Used in walk-in list D instead", CH["hic"]),
    ("The Crystal Room", "Naugatuck", "(203) 723-0206", "Chamber listing only; listed website now redirects to an unrelated site", CH["banquet"]),
    ("Flash Roofing LLC", "Prospect", "(860) 398-2166", "Chamber listing only; no website", CH["hic"]),
    ("Evergreen Lawn & Landscape", "Woodbury", "(203) 982-0400", "Chamber listing only; no website", CH["lawn"]),
    ("Royal Touch Services LLC", "Waterbury", "(203) 935-5977", "Chamber listing only; no website", WBY + "real-estate-&-construction---general-contractors"),
    ("Mirando Plumbing LLC", "Plantsville", "860-621-6987", "Chamber listing only; listed website does not resolve", SO + "mirando-plumbing-llc/"),
    ("J.C. Tonnotti Window Co., Inc.", "Southington", "860-621-1642", "Chamber listing only; listed website does not resolve", SO + "j-c-tonnotti-window-co-inc/"),
    ("Brothers' Tree Service LLC", "Watertown", "(203) 758-2767", "Seen only in search-result summaries; not fetched", "https://www.experience.com/reviews/brothers-22129112"),
    ("Route 63 Automotive (walk-in)", "Watertown", "203-217-0181", "Phone verified; hours not published", "https://route63automotive.com/"),
    ("New Millennium Barber Studio (walk-in)", "Waterbury", "(475) 235-4603", "Phone verified; hours not published", "https://newmillenniumbarberstudio.com/"),
    ("J M S Dry Cleaners & Laundry (walk-in)", "Naugatuck", "(203) 758-0526", "Phone verified; hours not published", "https://jmscleaners.com/"),
    ("SPYNE Pilates Studio (walk-in)", "Middlebury", "(203) 519-7496", "Phone verified; hours not published", "https://spynepilates.com/"),
    ("Fascia's Chocolates (walk-in)", "Waterbury", "(203) 753-0515", "Phone verified; store hours not on the page checked", "https://faschoc.com/"),
    ("Bethany Mountain Lawn Care, Inc.", "Prospect", "(203) 527-4563", "BBB only", BBB + "pest-control"),
    ("Chipman Septic Services, LLC", "Waterbury", "(203) 695-7014", "BBB only", BBB + "septic-tank-contractors"),
    ("Palmer Garage Doors, LLC", "Beacon Falls", "(203) 881-9979", "BBB only", BBB + "garage-doors"),
    ("Pinnacle Pest Management, LLC", "Waterbury", "(203) 754-2486", "BBB only; number not found elsewhere", BBB + "pest-control"),
    ("Eric K. Anderson Plumbing & Piping, LLC", "Prospect", "(203) 673-2891", "BBB only; number not found elsewhere", BBB + "plumber"),
    ("The Naugatuck Plumbing Company, LLC", "Naugatuck", "(203) 525-2913", "BBB only; number not found elsewhere", BBB + "plumber"),
]
EXCLUDED = [
    ("Ion Solar Pros", "Multi-state company; not an owner-operated local fit"),
    ("E G Home LLC", "New-construction homebuilder"),
    ("Peragallo Construction", "Homebuilder with out-of-state phone"),
    ("M.J. Daly, LLC", "Commercial/industrial only"),
    ("Allroads Car Wash", "Unattended 24/7 car wash"),
    ("Brass City Tile Designs", "No phone or hours on website"),
    ("Healthcare practices (chiropractors, etc.)", "Patient messaging raises HIPAA questions - excluded until Nova has a reviewed healthcare position"),
    ("National chains/franchises (Jiffy Lube, Davey Tree, LeafFilter, SERVPRO, Kumon, Mathnasium)", "Not owner-operated; decisions made elsewhere"),
]

COLS = ["assigned_list", "business_name", "industry", "phone", "address", "town", "website", "decision_maker", "decision_maker_source",
        "fit_rationale", "public_observation", "opener", "outreach_status", "next_action", "suppression_status", "notes",
        "verification", "verified_on", "source_urls"]
DCOLS = ["assigned_list", "geo_group", "business_name", "industry", "address", "town", "phone", "website", "hours", "hours_source",
         "visit_window", "introduction", "purpose", "appointment", "public_observation", "outreach_status", "next_action",
         "suppression_status", "notes", "verification", "verified_on", "source_urls"]

# ---- dedupe check (business / domain / phone) ----
def digits(p): return "".join(c for c in p if c.isdigit())[-10:]
seen = {}
for r in A + B + C + D:
    for k in (r["business_name"].lower(), digits(r["phone"]), (r.get("website") or "").split("/")[2] if r.get("website") else None):
        if not k: continue
        assert k not in seen, f"duplicate {k}: {r['business_name']} vs {seen[k]}"
        seen[k] = r["business_name"]

# ---- minimal XLSX writer (standard library only) ----
def col(n):
    s = ""
    while n: n, r = divmod(n - 1, 26); s = chr(65 + r) + s
    return s
def sheet_xml(rows):
    out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>']
    for i, row in enumerate(rows, 1):
        cells = "".join(f'<c r="{col(j)}{i}" t="inlineStr"{" s=\"1\"" if i == 1 else ""}><is><t xml:space="preserve">{escape(str(v))}</t></is></c>' for j, v in enumerate(row, 1))
        out.append(f'<row r="{i}">{cells}</row>')
    out.append(f'</sheetData><autoFilter ref="A1:{col(len(rows[0]))}{len(rows)}"/></worksheet>')
    return "".join(out)
def write_xlsx(path, sheets):
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + "".join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1, len(sheets) + 1)) + "</Types>")
        z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + "".join(f'<sheet name="{escape(n)}" sheetId="{i}" r:id="rId{i}"/>' for i, (n, _) in enumerate(sheets, 1)) + "</sheets></workbook>")
        z.writestr("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + "".join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1, len(sheets) + 1)) + f'<Relationship Id="rId{len(sheets) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
        z.writestr("xl/styles.xml", '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>')
        for i, (_, rows) in enumerate(sheets, 1):
            z.writestr(f"xl/worksheets/sheet{i}.xml", sheet_xml(rows))

def table(rows, cols): return [cols] + [[r.get(c, "") for c in cols] for r in rows]

readme = [["Nova prospect lists - read first"],
          [f"Researched {VERIFIED_ON} from public sources. Every row lists its source URLs."],
          ["A list is preparation, not permission. Nothing here authorizes a call, text, email or visit until Isaac approves the list and the person doing it."],
          ["No number has been screened against the National Do Not Call Registry or any internal suppression list. A published business phone is not consent to text or email."],
          ["Decision-maker names appear only where the business's own website names them. Do not look up personal phones, emails or home addresses."],
          ["Public observations are things anyone can see on the business's own pages. They are not evidence that the business is losing customers - ask, do not tell."],
          [f"Counts: List A {len(A)}, List B {len(B)}, List C {len(C)} (target 25 each); List D walk-in {len(D)} (target 20). Fewer than target because only verifiable businesses were kept."],
          ["Salesperson 1 and Salesperson 2 are placeholders until names, classification and compensation are confirmed."]]
xlsx = os.path.join(HERE, "Nova_Prospect_Lists_2026-10-13.xlsx")
write_xlsx(xlsx, [("Read first", readme), ("List A - Isaac", table(A, COLS)), ("List B - Salesperson 1", table(B, COLS)),
                  ("List C - Salesperson 2", table(C, COLS)), ("List D - Walk-in", table(D, DCOLS)),
                  ("Needs verification", [["business_name", "town", "phone (unverified)", "why not listed", "source"]] + [list(x) for x in NEEDS]),
                  ("Excluded", [["business", "reason"]] + [list(x) for x in EXCLUDED])])

# ---- CRM CSVs: the Sales Team import splits on plain commas, so no value may contain a comma ----
def clean(v): return " ".join(str(v).replace(",", " ").replace("\n", " ").split())
CRM = ["business_name", "industry", "website", "phone", "city", "state", "contact_name", "contact_title", "notes", "source"]
def crm_rows(rows, lst):
    out = []
    for r in rows:
        out.append([clean(r["business_name"]), clean(r["industry"]), clean(r.get("website", "")), clean(r["phone"]), clean(r["town"]), "CT",
                    clean(r.get("decision_maker") or "Owner or manager (name not yet confirmed)"), clean(r.get("decision_maker_source", "")),
                    clean(f"{lst}. Researched {VERIFIED_ON}. Not DNC-screened. No SMS or email consent. " + (("Observation: " + r["public_observation"]) if r.get("public_observation") else "")),
                    "public research " + VERIFIED_ON])
    return out
for name, rows, lst in (("list_A_isaac", A, "List A"), ("list_B_salesperson1", B, "List B"), ("list_C_salesperson2", C, "List C"), ("list_D_walkin", D, "List D walk-in")):
    with open(os.path.join(HERE, f"crm_import_{name}.csv"), "w", newline="", encoding="utf-8") as f:
        f.write(",".join(CRM) + "\n")
        for row in crm_rows(rows, lst):
            assert all("," not in v for v in row)
            f.write(",".join(row) + "\n")
print(f"A={len(A)} B={len(B)} C={len(C)} D={len(D)} needs_verification={len(NEEDS)} -> {xlsx}")
