import {useEffect,useRef,useState} from 'react';
import {Outlet,useLocation,useNavigate,Link} from 'react-router-dom';
import {Home,ClipboardList,Users,CalendarDays,Bot,MessagesSquare,BriefcaseBusiness,ChartNoAxesColumn,Settings,LogOut,Menu,X,Bell,Search,ArrowRight,Wallet,Network,Building2,GraduationCap,Plug,CheckSquare} from 'lucide-react';
import {supabase} from '../../lib/supabaseClient';
import {useAuthGuard} from '../../hooks/useAuthGuard';
import {useOrg} from '../../lib/OrgContext';
import NovaBrand from '../NovaBrand';
import '../../styles/NovaLuxe.css';

const NAV=[
 {to:'/dashboard',label:'Overview',icon:Home,permission:'overview.view',exact:true},
 {to:'/dashboard/audit',label:'Audit',icon:ClipboardList,permission:'intelligence.view'},
 {to:'/dashboard/leads',label:'Leads',icon:Users,permission:'growth.view'},
 {to:'/dashboard/calendar',label:'Calendar',icon:CalendarDays,permission:'admin.view'},
 {to:'/dashboard/workers',label:'Workers',icon:Bot,permission:'admin.view'},
 {to:'/dashboard/conversations',label:'Conversations',icon:MessagesSquare,permission:'admin.view'},
 {to:'/dashboard/intake-forms',label:'Bookings',icon:BriefcaseBusiness,permission:'intelligence.view'},
 {to:'/dashboard/crm',label:'Clients',icon:Building2,permission:'growth.view'},
 {to:'/dashboard/reports',label:'Reports',icon:ChartNoAxesColumn,permission:'overview.view'},
 {to:'/dashboard/cfo',label:'CFO & budgets',icon:Wallet,permission:'admin.view'},
 {to:'/dashboard/integrations',label:'Settings',icon:Settings,permission:'admin.view'},
];
const TOOLS=[{to:'/dashboard/intelligence',label:'Intelligence',icon:Network,permission:'intelligence.view'},{to:'/dashboard/growth',label:'Growth & marketing',icon:ChartNoAxesColumn,permission:'growth.view'},{to:'/dashboard/execution',label:'Execution & tasks',icon:CheckSquare,permission:'execution.view'},{to:'/dashboard/companies',label:'Companies',icon:Building2,permission:'companies.view'},{to:'/dashboard/admin',label:'Administration',icon:Settings,permission:'admin.view'},{to:'/dashboard/sales-team',label:'Sales team',icon:Users,permission:['sales.manage','sales.hiring','sales.finance']},{to:'/dashboard/academy',label:'Training',icon:GraduationCap,permission:'growth.view'},{to:'/dashboard/installations',label:'Installations',icon:Plug,permission:'growth.view'}];
export default function DashboardLayout(){
 const checking=useAuthGuard(),navigate=useNavigate(),loc=useLocation(),{loading,noAccess,hasPermission,currentMembership,currentOrg,currentOrgId,organizations,setCurrentOrg,user}=useOrg();
 const [open,setOpen]=useState(false),[search,setSearch]=useState(''),[commands,setCommands]=useState(false),[more,setMore]=useState(false);const searchRef=useRef(null);
 useEffect(()=>{const key=e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setCommands(true)}if(e.key==='Escape'){setCommands(false);setOpen(false)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 useEffect(()=>setOpen(false),[loc.pathname]);
 const permitted=item=>Array.isArray(item.permission)?item.permission.some(hasPermission):hasPermission(item.permission),nav=NAV.filter(permitted),tools=TOOLS.filter(permitted),name=user?.user_metadata?.full_name||user?.email?.split('@')[0]||'Your account',role=currentMembership?.role==='nova_super_admin'?'Owner':(currentMembership?.role||'Member').replaceAll('_',' ');
 async function logout(){try{await supabase?.auth.signOut()}catch{}navigate('/login')}
 if(checking||loading)return <div className="nova-login-loading" role="status"><NovaBrand/><span>Opening your workspace…</span></div>;
 if(noAccess)return <div className="nova-login-loading"><NovaBrand/><p>This account has no organization access. Contact Nova to arrange access.</p><button className="luxe-outline" onClick={logout}>Sign out</button></div>;
 const active=item=>item.exact?loc.pathname===item.to:loc.pathname.startsWith(item.to);
 function Sidebar({drawer=false}){return <aside className={'luxe-sidebar '+(drawer?'is-drawer':'nova-dashboard-sidebar')} aria-label={drawer?'Mobile navigation':'Main navigation'}><Link className="luxe-sidebar-logo" to="/dashboard"><NovaBrand/></Link><nav className="luxe-nav">{nav.map(({icon:Icon,...item})=><Link to={item.to} key={item.to} className={active(item)?'is-active':''} aria-current={active(item)?'page':undefined}><Icon/>{item.label}</Link>)}<button className="luxe-link" style={{padding:'12px 15px'}} onClick={()=>setMore(!more)} aria-expanded={more}>All tools <ArrowRight size={13}/></button>{more&&tools.map(({icon:Icon,...item})=><Link to={item.to} key={item.to} className={active(item)?'is-active':''}><Icon/>{item.label}</Link>)}</nav><div className="luxe-sidebar-end"><strong>NOVA SYSTEMS</strong><p>PEOPLE<br/>SYSTEMS<br/>GROWTH</p>{organizations.length>1&&<select className="luxe-org-select" aria-label="Current organization" value={currentOrgId||''} onChange={e=>setCurrentOrg(e.target.value)}>{organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select>}<button onClick={logout}><LogOut size={13}/>Sign out</button></div></aside>}
 return <div className="luxe-shell"><Sidebar/>{open&&<><div className="luxe-drawer-shade" onClick={()=>setOpen(false)}/><Sidebar drawer/></>}<main className="luxe-main nova-dashboard-main"><header className="luxe-topbar"><button className="luxe-mobile-toggle" onClick={()=>setOpen(v=>!v)} aria-label={open?'Close navigation menu':'Open navigation menu'} aria-expanded={open}>{open?<X size={21}/>:<Menu size={21}/>}</button><form className="luxe-search" onSubmit={e=>{e.preventDefault();setCommands(true)}}><Search size={18}/><input ref={searchRef} aria-label="Search workspace" placeholder="Search audits, workers, or anything…" value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setCommands(true)}/><kbd>⌘ K</kbd></form><div className="luxe-topbar-right"><Link className="luxe-notifications" to="/dashboard/cfo" aria-label="Open budget requests"><Bell size={22}/></Link><div className="luxe-profile"><span aria-hidden="true">{name.slice(0,1).toUpperCase()}</span><div><p>{name}</p><small>{role} · {currentOrg?.name||'Nova Systems'}</small></div></div></div></header><Outlet/></main>{commands&&<div className="luxe-modal-backdrop" onClick={()=>setCommands(false)}><section className="luxe-modal" role="dialog" aria-modal="true" aria-label="Search workspace" onClick={e=>e.stopPropagation()}><header><h2>Find your next step</h2><button aria-label="Close search" onClick={()=>setCommands(false)}><X size={20}/></button></header><input className="luxe-input" aria-label="Find a workspace tool" autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your tools…"/><div className="luxe-command-results" style={{marginTop:18}}>{[...nav,...tools].filter(item=>item.label.toLowerCase().includes(search.toLowerCase())).map(({icon:Icon,...item})=><Link key={item.to} to={item.to} onClick={()=>{setCommands(false);setSearch('')}}><Icon size={17}/>{item.label}<ArrowRight size={14} style={{marginLeft:'auto'}}/></Link>)}</div></section></div>}</div>;
}
