/* Idle Ascension · configuración de equilibrio.
   Todos los números del juego viven aquí. Lo usan el motor (engine.js) y la interfaz (ui.js). */
(function(root){
const CFG = {
  // Clases: sin pasivas propias; lo que las hace distintas va en sus estadísticas base (el Guerrero recibe un 5 % menos
  // de daño con dmgTaken, el Clérigo se regenera con regen) y en su habilidad. La pasiva llega con el camino de la 1.ª evolución.
  classes: {
    Guerrero:{hp:250.6,ghp:2.105,   // +30 % de vida (tanque)
     atk:19.35,gatk:0.26,df:12.35,gdf:0.1049,spd:0.72,cr:0,cd:1.0,ev:0,ranged:false,color:'#d9774a',dmgTaken:0.95, role:'Tanque · cuerpo a cuerpo'},
    Mago:{hp:138.82,ghp:1.0977,atk:20.959,gatk:0.3051,df:4.12,gdf:0.035,spd:0.84,cr:0,cd:1.0,ev:0,ranged:true,color:'#8f7cf0', role:'Daño · a distancia'},
    Arquero:{hp:131.06,ghp:1.1558,atk:24,gatk:0.09,df:5.15,gdf:0.0437,spd:1.365,cr:0.05,cd:1.0,ev:0.05,ranged:true,color:'#5fb86a', role:'Daño · a distancia'},
    Asesino:{hp:142.29,ghp:0.9114,atk:20.13,gatk:0.18,df:4.12,gdf:0.035,spd:1.0,cr:0.10,cd:1.5,ev:0.15,ranged:false,color:'#c95a8a', role:'Daño · cuerpo a cuerpo'},
    Clerigo:{hp:228.46,ghp:1.4863,atk:14.6,gatk:0.3015,df:12.35,gdf:0.105,   // +50 % de defensa (tanque)
     spd:0.8,cr:0,cd:1.0,ev:0,ranged:true,color:'#e9c75a',regen:0.005, role:'Tanque · a distancia', label:'Clérigo'},
  },
  enemy:{hp:45,hpG:1.0358,atk:6,atkG:1.026,earlyTo:50,hpG0:1.035,atkG0:1.024, // hasta la fase 50 crecen con hpG0/atkG0
         hpBands:[[101,1.051,1.036]], // de la fase 101 a la 150 los enemigos crecen más: la fase 150 llega hacia el día 13
         walls:{50:{hp:5.74,atk:2.71},100:{hp:2.5,atk:1.95},150:{hp:1.7,atk:1.55}}, // jefes de élite de Normal con valores propios (misma escala que eliteHp/eliteAtk)
         df:3,dfG:1.0119,waveHp:0.0145,
         bossHp:1.5,bossAtk:1.5,   // (respaldo: bossBands manda) jefe cada 10 fases: vida en oleadas (1 = toda la oleada de su fase), ataque en enemigos (1 = un enemigo)
         bossBands:[[1,1.5,1.5],[51,2.0,1.7],[101,1.7,1.6],[151,1.6,1.55]], // [desde fase, vida, ataque]: los jefes normales frenan unas horas en cada tramo
         eliteHp:3,eliteAtk:2,     // (respaldo: walls manda) jefe de élite cada 50 fases (mismas unidades)
         extraEvery:50,spd:0.8,walk:2.0,dash:0.05, // dash: Embestida de los de cuerpo a cuerpo (esperan el 5 % del camino)
         // Oleadas progresivas: n0 enemigos (+1 cada nEvery fases, máx. nMax); salen g0 a la vez (+1 cada gEvery fases, máx. gMax),
         // separados gap s; andan y pegan hasta un spd más rápido en la fase 150. La vida de la oleada entera es la de siempre
         // (repartida entre más enemigos) × hpMul; atkG: ataque de cada enemigo × atkG por cada uno de más que sale a la vez.
         waves:{n0:3,nEvery:25,nMax:8,g0:1,gEvery:50,gMax:3,gap:0.35,spd:0.2,hpMul:1.12,atkG:0.85},
        
         // Números pequeños: el ataque enemigo baja lo mismo que la vida y la defensa del héroe, × (1,008 / 1,0226)^u,
         // con u = nivel medio de mejoras de Vida/Defensa con que se vence cada fase (medido con simulaciones). [fase, u]
         atkShrink:[[1,0],[10,0],[20,8],[30,14],[40,23],[49,31],[50,59],[60,60],[70,64],[80,69],[90,77],[100,93],[110,100],[120,115],[130,128],[140,142],[150,151]]},
  // waveXp: experiencia extra al ganar cada oleada (en «muertes»: una oleada da 3 por sus enemigos + waveXp)
  econ:{gold:0.45,goldG:1.0198,bossGold:10,xp:4,waveXp:3,xpG:1.0389,xpReq:1300,xpReqG:1.077, xpBands:[[101,1.0,0.06],[151,1.05,1]], // nivel 100 hacia el día 8-9; xpBands: [desde nivel, crecimiento] para niveles altos
       bossScrap:{base:4,per10:2,farm:10}}, // chatarra por jefe: 4 + 2 cada 10 fases (jefe de la 150 repetido: 10), × (modo+1)
  upgrades:{ // coste ×1,031 por nivel (antes ×1,0325): compensa el calendario que ya no existe
    atk:{name:'Daño',base:25,g:1.031,mult:1.0226},
    hp:{name:'Vida',base:25,g:1.031,mult:1.008,ref:1.0226}, // números pequeños: +0,8 % por nivel (antes +2,26 %: ref)
    df:{name:'Defensa',base:25,g:1.031,mult:1.008,ref:1.0226},
    spd:{name:'Velocidad de ataque',base:5,g:1.031,mult:1.004}, // +0,4 % por nivel; más barata para que rinda como las demás
  },
  rar:['C','U','R','E','L','M'],
  rarName:{C:'Común',U:'Poco común',R:'Rara',E:'Épica',L:'Legendaria',M:'Mítica'},
  weapon:{ // daño%, velocidad%, nº stats
    C:[0.06,0.02,1],U:[0.11,0.036,2],R:[0.20,0.065,2],E:[0.36,0.12,3],L:[0.65,0.21,3],M:[1.0,0.32,4],
    invMax:50, // inventario: como mucho 50 armas (la equipada no cuenta: va en el Equipo); para abrir cofres hacen falta huecos libres
    lvlPct:0.25,maxLvl:5, // nv5 = ×2 del base: una nv5 supera un poco a la siguiente rareza nv1; nivel N -> N+1 cuesta N armas iguales + chatarra
    scrapLvl:{C:0,U:10,R:30,E:60,L:120,M:240},
    scrapDis:{C:2,U:5,R:15,E:40,L:100,M:250},
    // efecto de las armas Legendarias (y Míticas) de cada clase. SIN BALANCEAR.
    legend:{
      Guerrero:{id:'tajo', name:'Tajo partido', mult:0.5, desc:'Sus golpes dan también al enemigo de detrás (50 %)'},
      Mago:{id:'vacio', name:'Vacío', ignoreDf:0.3, desc:'Sus golpes ignoran el 30 % de la defensa'},
      Arquero:{id:'rafaga', name:'Ráfaga', every:4, arrows:2, desc:'Cada 4.º disparo son 2 flechas'},
      Asesino:{id:'filoVacio', name:'Filo del vacío', desc:'Los críticos ignoran toda la defensa'},
      Clerigo:{id:'llamarada', name:'Llamarada solar', every:5, pct:0.2, dur:3, desc:'Cada 5.º golpe quema a todos (20 % por s, 3 s)'}},
    refund:0.6,
    reforge:{C:3,U:5,R:10,E:20,L:40,M:80},reforgeStep:0.2,reforgeCap:3, // coste = base × (1 + 0,2 por reforja hecha), como mucho ×3
  },
  sec:{
    hpp:{n:'Vida',C:[3,6],U:[5,8],R:[8,12],E:[10,15],L:[15,20],M:[20,26]},
    dfp:{n:'Defensa',C:[3,6],U:[5,8],R:[8,12],E:[10,15],L:[15,20],M:[20,26]},
    cr:{n:'Crítico',C:[2,4],U:[3,5],R:[5,8],E:[7,10],L:[10,14],M:[14,18]},
    cd:{n:'Daño crítico',C:[10,20],U:[15,25],R:[25,40],E:[35,50],L:[50,70],M:[70,90]},
    ls:{n:'Robo de vida',C:[1,2],U:[2,3],R:[3,4.5],E:[4,6],L:[6,8],M:[8,10]},
    bd:{n:'Daño a jefes',C:[5,10],U:[8,12],R:[12,18],E:[15,25],L:[25,35],M:[35,45]},
  },
  caps:{cr:0.5,ls:0.2},
  names:{
    Guerrero:['Espada oxidada','Espada de acero','Hoja del capitán','Mandoble rúnico','Hacha del Titán','Espada del Primer Rey'],
    Mago:['Varita de sauce','Bastón de roble','Báculo de cristal','Cetro arcano','Báculo del Eclipse','Bastón del Origen'],
    Arquero:['Arco corto','Arco largo','Arco élfico','Arco de viento','Arco Tormenta','Arco Celestial'],
    Asesino:['Dagas melladas','Dagas de acero','Colmillos gemelos','Dagas sombrías','Dagas del Vacío','Dagas del Fin'],
    Clerigo:['Maza de madera','Maza de hierro','Maza bendita','Martillo sagrado','Maza Solar','Maza del Alba'],
  },
  // Cofres: % por MODO (Normal en dos tramos, Pesadilla, Infierno) → [% Común, Poco común, Rara, Épica, Legendaria, Mítica].
  // Los % NO se escriben a mano: salen de las fórmulas de CHEST_PLAN (abajo del todo). Cada cofre da 1 arma.
  chests:{
    wood:{name:'Madera',from:'Jefes y eventos'},
    silver:{name:'Plata',from:'Tienda (oro)',goldMin:5,perDay:null,step:0.1}, // precio: el oro de 5 min farmeando tu récord, +10 % por cada compra del día (vuelve al base cada día); sin límite
    mode:{name:'Modo',from:'Tienda',price:100}, // 100 tokens (1 $)
  },
  // Tokens = dinero: 100 tokens = 1 $. Dos saldos: comprados (no se retiran) y ganados en los pools (se pueden retirar).
  // Al gastar se usan primero los comprados. Compras y retiros SIMULADOS hasta que haya servidor y pasarela de pago.
  // open: se pueden comprar tokens (poner a true al conectar Telegram Stars); mientras, lo que se paga con tokens sale "Próximamente"
  // Paquetes de tokens con descuento por cantidad: bonus = tokens de regalo (500: +5 %, 1000: +10 %, 2500: +20 %).
  // Reparto de cada compra (en valor de tokens a precio base, 2 tokens por Star): 30 % para ti; el 70 % restante vuelve a
  // los jugadores = regalo del paquete + lo que va al bote (bote = 70 % − regalo). Así el descuento sale del bote, no de tu 30 %.
  tokens:{perUsd:100, open:true, packs:[100,500,1000,2500], bonus:{500:25,1000:100,2500:500}, keep:0.3, withdraw:{fee:0.15, min:100}}, // retiro: solo en pruebas locales (desactivado en Telegram)
  // Misiones diarias (se renuevan cada día): cada una da oro (minutos de farmeo de tu récord) y experiencia del pase
  missions:{list:[
      // rew: premio de cada misión (gold = minutos de farmeo de tu récord). Entre todas: oro de 4 h, 3 madera, 1 plata (la de anuncios), 1 ticket.
      // La más fácil (enemigos) solo da XP del pase. Todas dan xp del pase.
      {k:'ad',n:5,t:'Mira 5 anuncios',rew:{silver:1}},
      {k:'event',n:1,t:'Juega la Mazmorra o el Jefe semanal',rew:{gold:60,wood:1,ticket:1}},
      {k:'chests',n:5,t:'Abre 5 cofres',rew:{gold:60,wood:1}},
      {k:'upgrade',n:10,t:'Compra 10 mejoras',rew:{gold:60,wood:1}},
      {k:'pvp',n:3,t:'Juega 3 PvP',rew:{gold:60}},
      {k:'kills',n:300,t:'Derrota 300 enemigos',rew:{}}],
    xp:20, bonus:{gold:60,silver:1,wood:2}, // bonus: al recoger todas las diarias del día
    // Misiones semanales (de lunes a domingo). Entre todas: oro de 6 h, 5 madera, 2 plata (la de anuncios), 1 ticket.
    weekly:{list:[
      {k:'ad',n:30,t:'Mira 30 anuncios',rew:{silver:2}},
      {k:'event',n:5,t:'Juega 5 veces la Mazmorra o el Jefe semanal',rew:{gold:70,wood:1}},
      {k:'alldays',n:7,t:'Completa todas las misiones diarias cada día',xp:120,rew:{gold:150,wood:2,ticket:1}},   // la que más da (un día cuenta al recoger las 5 diarias)
      {k:'chests',n:25,t:'Abre 25 cofres',rew:{gold:70,wood:1}},
      {k:'upgrade',n:60,t:'Compra 60 mejoras',rew:{gold:70,wood:1}},
      {k:'kills',n:5000,t:'Derrota 5.000 enemigos',rew:{}}],
      xp:40, bonus:{gold:120,silver:3}}}, // bonus: al recoger todas las semanales
  // Calendario de 7 días: un premio por cada día que entras (no hace falta seguidos); tras el 7.º vuelve a empezar
  calendar:[{gold:30,wood:2},{silver:2},{ess:1,wood:2},{silver:3},{ev:2,wood:3},{silver:5},{mode:1}],
  // Pase de temporada: 30 días, 50 niveles de 85 XP (diarias 100 XP/día + semanales 320 XP/semana ≈ nivel 50 hacia el día 29).
  // Línea gratis y línea de pago (Stars). Nivel 50: arma Rara (gratis) y Épica (pago). Pago: 60 tokens cada 10 niveles (300 = 3 $).
  pass:{days:30, levels:50, xp:85, item:{free:'R',prem:'E'}, tok:{every:10,n:60}},
  // Ofertas en el momento justo (se pagan con Stars; duran 'dur' horas y no vuelven a salir hasta pasadas 'cool' horas)
  //  wall: llevas 'hours' horas sin superar tu récord · evo: tienes el nivel para evolucionar pero te faltan materiales · inv: inventario lleno
  offers:{dur:24, cool:72,
    wall:{stars:100, t:'Rompe el muro', b:{mode:3,silver:10}, hours:4},
    evo:{stars:100, t:'Pack de evolución', b:{ess:3,ev:12}},
    inv:{stars:100, t:'Inventario +25', inv:25, max:2}},
  // Comprar tokens con TON / USDT (función "crypto"; sin retiros). on:true cuando el secreto TON_ADDRESS esté puesto en Supabase.
  crypto:{on:false, url:'https://xdtxdaywotkppzssrjni.supabase.co/functions/v1/crypto', manifest:'https://zekkon24.github.io/idle-ascension/tonconnect-manifest.json'},
  // Pagos con Telegram Stars (función "pay" del servidor; el precio que manda es el del servidor). 100 tokens = 50 Stars.
  stars:{url:'https://xdtxdaywotkppzssrjni.supabase.co/functions/v1/pay', perToken:0.5,
    first:{stars:50, r:'U', tokens:150, silver:5},   // oferta de bienvenida: una sola vez
    pass:{stars:250}},
  // Sorpresas en la campaña (cada every±jitter s de combate; no en jefes ni eventos): Horda (dur s, enemigos ×count, oro ×gold)
  // o Jefe errante (vida = hp × la vida de la oleada, ataque ×atk; hay que vencerlo en dur s → cofre de plata)
  surprise:{every:600, jitter:120, horde:{dur:30,count:2,gold:2}, wander:{dur:20,hp:1.5,atk:1.5,reward:{silver:1}}},
  // Jefes de campaña con fases: al bajar de 'at' de vida, al azar se enfurecen (ataque y velocidad ×rage) o invocan 'summon' enemigos normales
  bossPhase:{at:0.5, rage:1.3, summon:[2,3]},
  // Torre (roguelike): mapa de pisos con caminos; entras con tu héroe y sumas mejoras de cualquier clase durante la partida.
  // 3 vidas por partida (perder un combate = −1 vida y repites el piso); vida extra con tokens. Enemigos: los de tu fase récord
  // × hp0·hpG^(piso−1) de vida y × atk0·atkG^(piso−1) de ataque. Premios la 1.ª vez que llegas a cada piso.
  // Base de los enemigos = (los de tu fase récord)^w × (los «a tu medida»)^(1−w): con w bajo, tus estadísticas pesan poco.
  // «A tu medida»: tardas tKill s en matar a uno normal y cada golpe suyo te quita hitPct de tu vida (en el piso 1).
  // Crecimiento por tramos: curve=[[desde piso, ×vida por piso, ×ataque por piso], …] (suave hasta el 50, duro hasta el 100, muy duro después).
  tower:{lives:3, lifeCost:50, w:0.35, tKill:1.0, hitPct:0.02, curve:[[1,1.05,1.035],[50,1.13,1.08],[100,1.22,1.13]], hp0:1, atk0:1, count0:4, countEvery:5, countMax:10, group:3,
    elite:{n:3,hp:3,atk:1.5}, boss:{every:10,hp:2,atk:2}, maxSkills:2,
    // saltos de dificultad: desde 'from' los élites se hacen mucho más duros (×eliteUp cada 'every' pisos); cada 'jumpEvery' pisos
    // todo sube de golpe (×jump); desde 'forcedFrom', a veces (forced) el piso solo ofrece combates (élite y/o combate, sin hoguera ni cofre)
    hard:{eliteFrom:30, eliteEvery:10, eliteUp:1.4, jumpEvery:25, jump:1.3, forcedFrom:15, forced:0.3},
    nodes:{fight:50,elite:20,treasure:15,rest:15}, // peso de cada tipo de camino
    rewards:[{every:50,b:{mode:1}},{every:25,b:{silver:1}},{every:5,b:{wood:1}}],
    // rareza de las cartas: C común, R rara, L legendaria (las pasivas de camino, objetos y hechizos existentes son legendarias)
    rarity:{normal:{C:50,R:35,L:15}, better:{C:30,R:45,L:25}},   // better: élite y jefe
    // mejoras propias de la Torre (las comunes se pueden repetir y se acumulan)
    fx:{
      fuerza:{r:'C',name:'Fuerza',desc:'+15 % de daño',atk:0.15},
      aguante:{r:'C',name:'Aguante',desc:'+20 % de vida máxima (y te cura esa parte)',hp:0.2},
      rapidez:{r:'C',name:'Rapidez',desc:'+12 % de velocidad de ataque',spd:0.12},
      precision:{r:'C',name:'Precisión',desc:'+8 % de crítico',cr:0.08},
      vampiro:{r:'C',name:'Vampiro',desc:'5 % de robo de vida',ls:0.05},
      aliento:{r:'C',name:'Segundo aliento',desc:'Al ganar cada combate recuperas el 15 % de la vida',heal:0.15},
      escudo:{r:'R',name:'Escudo inicial',desc:'Empiezas cada combate con un escudo del 20 % de tu vida',shield:0.2},
      espinas:{r:'R',name:'Espinas',desc:'Devuelves el 30 % del daño que recibes',reflect:0.3},
      ejecutor:{r:'R',name:'Ejecutor',desc:'+50 % de daño a enemigos por debajo del 30 % de vida',below:0.3,mult:0.5},
      recarga:{r:'R',name:'Recarga rápida',desc:'Las habilidades recargan un 25 % más rápido',cd:0.75},
      cadena:{r:'R',name:'Cadena',desc:'Cada 5.º golpe salta también a otro enemigo',every:5},
      cristal:{r:'R',name:'Cristal',desc:'+40 % de daño, pero −25 % de vida',atk:0.4,hp:-0.25},
      furia:{r:'R',name:'Furia sangrienta',desc:'+1 % de daño por cada 1 % de vida que te falta',per:1},
      explosion:{r:'L',name:'Explosión',desc:'Los enemigos que mueren explotan: 30 % de su vida a los cercanos',pct:0.3},
      eco:{r:'L',name:'Eco',desc:'Tus hechizos de la Torre se lanzan dos veces'},
      maestria:{r:'L',name:'Maestría',desc:'Tus pasivas de la Torre son un 50 % más fuertes',mult:1.5},
      pacto:{r:'L',name:'Pacto',desc:'Pierdes 1 vida de la partida y eliges 2 mejoras más'},
      // objetos de la Torre (obj:true)
      afilar:{r:'C',obj:true,name:'Piedra de afilar',desc:'Los 3 primeros golpes de cada combate son críticos',n:3},
      talisman:{r:'C',obj:true,name:'Talismán de piedra',desc:'Recibes un 10 % menos de daño',taken:0.1},
      hielo:{r:'R',obj:true,name:'Orbe de hielo',desc:'15 % de congelar 1 s al enemigo que golpeas',chance:0.15,dur:1},
      colmillo:{r:'R',obj:true,name:'Colmillo',desc:'Los críticos te curan el 2 % de tu vida',heal:0.02},
      corona:{r:'L',obj:true,name:'Corona del rey',desc:'+1 vida en la partida'},
      reloj:{r:'L',obj:true,name:'Reloj de arena',desc:'Cada 20 s todas tus habilidades se recargan al instante',every:20},
      martillo:{r:'L',obj:true,name:'Martillo del trueno',desc:'Cada 8 s un rayo golpea a todos los enemigos (200 % de tu daño)',every:8,mult:2}}},
  // PvP asíncrono: duelo al mejor de 3 contra la copia de otro jugador o un «fantasma» (rival generado a tu nivel).
  // Antes de cada ronda eliges 1 de 3 cartas (mejoras de la Torre, se acumulan en el duelo). Ronda: hasta 'round' s (si nadie
  // cae, gana quien tenga más % de vida). Estadísticas mezcladas: tu^mix × media^(1−mix). Liga semanal con puntos tipo ELO (k).
  // PvP: combate contra el fantasma de otro jugador (su partida al 100 %, la maneja la IA). Elo para pocos jugadores:
  // K alto (kNew) en las primeras newGames partidas y luego k; al defensor le cambia la mitad (defK). SIN BALANCEAR.
  // maxT: segundos máximos del combate (si nadie cae, gana quien tenga más % de vida). botSpread: puntos del bot ± este valor.
  // ttk: la vida de los dos en el duelo se multiplica igual, para que solo con ataques normales se tarde ~ttk s (con habilidades, menos)
  // cls: multiplicador del daño que hace cada clase en PvP. Calibrado (días 4-60, mejoras al azar) para ganar de media:
  // Mago 55 %, Asesino 52 %, Arquero 50 %, Clérigo 48 %, Guerrero 45 % (el Mago tiene ventaja: es su modo)
  // Rival: el jugador más cercano en puntos, sin repetir ninguno de tus últimos 'recent' duelos (lo decide el servidor)
  // free: duelos gratis al día; después 1 ticket PvP por duelo (paquete de 'pack' tickets por 'packCost' tokens = 1 $)
  // rewards: premio del ranking semanal según tu puesto (igual que el Jefe semanal); lo reparte el servidor el lunes y los puntos
  // quedan a medio camino de 1000. leagues: insignia según los puntos ([desde, nombre, color])
  pvp:{free:3, pack:3, packCost:100, recent:5, maxT:90,
    rewards:[{to:1,em:15,ch:'mode',n:3},{to:3,em:12,ch:'mode',n:3},{to:10,em:9,ch:'silver',n:6},{to:25,em:6,ch:'silver',n:3},{to:50,em:3,ch:'silver',n:3},{to:100,em:3,ch:'silver',n:2}],
    leagues:[[0,'Bronce','#c07a45'],[1100,'Plata','#b9c0cc'],[1300,'Oro','#e8b04a'],[1500,'Diamante','#6fc7e8'],[1700,'Leyenda','#c86bff']], ttk:31, cls:{Guerrero:1.77,Mago:0.75,Arquero:1.12,Asesino:1.04,Clerigo:0.65}, start:1000, k:24, kNew:40, newGames:10, defK:0.5, botSpread:60, near:5},
  // Racha: +pct de oro por cada 'per' muertes seguidas sin recibir golpe (máx. max); se pierde al recibir un golpe
  streak:{per:10, pct:0.01, max:0.25},
  // Ruleta diaria: 1 tirada gratis al día + 1 con anuncio. w = peso (probabilidad relativa)
  wheel:[{b:{gold:30},w:20},{b:{gold:60},w:15},{b:{gold:180},w:6},{b:{wood:1},w:15},{b:{wood:2},w:10},{b:{wood:3},w:5},
    {b:{silver:1},w:8},{b:{ticket:1},w:6},{b:{ess:1},w:5},{b:{ev:3},w:8},{b:{mode:1},w:2}],
  shopTab:false, // pestaña Tienda: oculta hasta tener el juego casi terminado (su contenido sigue en el código)
  startWeapon:'C',
  // Grimorio: la LLAVE de la 1.ª evolución. Uno por clase. Se consigue CERRADO (oro + esencias + emblemas, o tokens) y se sube
  // del nivel 1 al 5: cada subida pide tiempo luchando con él (secs, también cuenta el tiempo sin conexión) + recursos.
  // Con el grimorio en el nivel 5 y el héroe en el nivel de la evolución, se evoluciona eligiendo uno de 2 caminos (evo.tiers[0]).
  // Cambiar de camino después cuesta switchCost tokens. fx: números de la pasiva de cada camino B. SIN BALANCEAR.
  grimoire:{showLvl:50, // icono del Grimorio (libro) en el combate desde este nivel del héroe (o si ya se tiene)
    levels:5, switchCost:250, cost:{goldH:2,ess:2,ev:4}, pack:300,
    up:[{secs:7200,goldH:1,ess:1,ev:2},{secs:10800,goldH:2,ess:1,ev:3},{secs:14400,goldH:3,ess:2,ev:4},{secs:21600,goldH:4,ess:2,ev:5}],
    names:{Guerrero:'Grimorio del Guerrero',Mago:'Grimorio del Mago',Arquero:'Grimorio del Arquero',Asesino:'Grimorio del Asesino',Clerigo:'Grimorio del Clérigo'},
    fx:{fortaleza:{df:0.1,boss:0.5}, escarcha:{need:3,mult:2.1,freeze:2,ignoreDf:0.5}, cazador:{boss:0.4}, veneno:{pct:0.7,dur:8,max:8}, sacrificio:{cost:0.02,atk:0.6,lsMax:0.2,single:true}}},
  // Habilidades activas (elegidas por el diseñador): la de clase es directa (golpe/cura al momento); la de evolución da un efecto unos segundos. En los eventos se usan a mano;
  // en la campaña se lanzan solas (si opt.autoSkills no está apagado). cd = recarga en segundos de combate. SIN BALANCEAR.
  skills:{
    cls:{
      Guerrero:{id:'muro', name:'Muro de escudos', cd:18, shield:3, dmgDef:5, desc:'Escudo según su defensa y golpe en área con parte de su defensa'},
      Mago:{id:'bola', name:'Bola de fuego', cd:12, targets:3, mult:3, burn:0.5, dur:4, desc:'300 % en área hasta a 3 enemigos y los quema'},
      Arquero:{id:'perforante', name:'Disparo perforante', cd:15, mult:3, desc:'Disparo que atraviesa a todos (300 %)'},
      Asesino:{id:'ejecutar', name:'Ejecutar', cd:12, mult:9, refund:0.5, desc:'Golpe del 900 %; si mata, la recarga baja a la mitad'},
      Clerigo:{id:'luz', name:'Golpe de luz', cd:15, hits:6, mult:0.2, back:0.6, heal:0.05, desc:'6 golpes de luz encadenados (20 % cada uno) que luego vuelven y le curan (5 % de vida cada uno)'}},
    evo:{
      Guerrero:{id:'sed', name:'Sed de sangre', cd:28, cost:0.2, shield:0.5, ls:0.4, dur:12, desc:'Pierde el 20 % de su vida: escudo de la mitad y +40 % de robo de vida 12 s'},
      Mago:{id:'combustion', name:'Combustión', cd:28, dur:8, burnUp:0.5, desc:'8 s: las quemaduras hacen +50 % y los que mueren quemados la pasan a otro'},
      Arquero:{id:'rapido', name:'Fuego rápido', cd:28, dur:6, spd:1.75, desc:'6 s con +75 % de velocidad de ataque'},
      Asesino:{id:'clon', name:'Clon de sombra', cd:28, dur:8, mult:0.3, desc:'8 s: un clon copia sus golpes al 30 %'},
      Clerigo:{id:'juicio', name:'Luz del juicio', cd:30, dur:6, heal:0.05, dps:1.0, desc:'6 s: aura que le cura el 5 % por segundo y quema a los enemigos cercanos'}},
    // habilidad de evolución del camino B: POR DECIDIR (null = aún no hay)
    evoB:{
      Guerrero:{id:'baluarte', name:'Baluarte', cd:45, dur:8, df:1.25, reflect:0.75, desc:'8 s: +25 % de defensa y devuelve el 75 % del daño que recibe'},
      Mago:{id:'armaduraHielo', name:'Armadura de hielo', cd:28, dur:8, shards:2, burst:4, desc:'Lanza 4 esquirlas a todos; 8 s: quien le pega recibe 2 esquirlas'},
      Arquero:{id:'marca', name:'Marca del cazador', cd:35, dur:8, mult:0.5, desc:'8 s: el objetivo recibe +50 % de daño'},
      Asesino:{id:'nube', name:'Nube tóxica', cd:60, dur:2, pct:0.05, extra:3, desc:'2 s: una nube envenena a todos cada segundo (+3 acumulaciones)'},
      Clerigo:{id:'sacrificio', name:'Sacrificio', cd:28, cost:0.3, dur:8, atk:0.6, single:true, desc:'Consume el 30 % de su vida: +60 % de daño a los jefes durante 8 s'}}},
  matShop:{ess:50, ev:25}, // tienda: Esencia 50 tokens, Emblema 25 tokens
  boosts:{ // potenciadores por anuncios (cada uso pide 'ads' anuncios; 'perDay' usos al día)
    speed:{ads:2,min:15,mult:2,perDay:3}, // combate ×2 durante 15 min reales (se acumula si ya está activo)
    gold:{ads:2,hours:1,earlyHours:0.5,earlyUntil:50,perDay:3}, // oro de 1 h farmeando tu fase récord (30 min hasta pasar la fase 50)
  },
  evo:{ // evoluciones: al llegar al nivel de cada una se gana su pasiva y el nivel sigue (hasta evolucionar, ese nivel es el tope)
    tiers:[
      {lvl:150, cost:{ess:3,gold:10000,ev:12}, bonus:{hp:0.15,atk:0.15}, classes:{ // cost: esencias del modo Normal + oro + material del evento · bonus: extra de vida y daño
        Guerrero:{name:'Berserker',passive:'Furia: +1 % de daño por cada golpe recibido en la oleada (máx. +45 %)',rage:0.01,rageCap:0.45},
        Mago:{name:'Archimago',passive:'Fuego: cada golpe quema al enemigo; la quemadura se acumula hasta 5 veces',burnPct:0.3,burnDur:3,burnMax:5},
        Arquero:{name:'Tirador',passive:'Disparo doble: 15 % de probabilidad de disparar dos veces',double:0.15},
        Asesino:{name:'Sombra',passive:'Instinto: +10 % de velocidad de ataque, recibe un 15 % menos de daño y tras un crítico el siguiente golpe hace +30 %',critNext:0.3,base:{spd:1.1,dmgTaken:0.85}},
        Clerigo:{name:'Oráculo',passive:'Luz interior: al bajar del 50 % de vida, la regeneración se triplica 10 s (1 vez por oleada)',lightHp:0.5,lightMult:3,lightDur:10},
      },
      // camino B (el opuesto): su pasiva es un efecto de grimorio (grimoire.fx[grim])
      alt:{
        Guerrero:{name:'Guardián',grim:'fortaleza',passive:'Fortaleza: +10 % de defensa y +50 % de daño a los jefes'},
        Mago:{name:'Criomante',grim:'escarcha',passive:'Escarcha: clava esquirlas; con 3 hace 210 % ignorando el 50 % de su defensa y lo congela 2 s (no se mueve ni ataca)'},
        Arquero:{name:'Cazador',grim:'cazador',passive:'Cazador: +40 % de daño a los jefes'},
        Asesino:{name:'Envenenador',grim:'veneno',passive:'Veneno: cada golpe envenena (70 % por s, 8 s), hasta 8 veces: brilla en peleas largas'},
        Clerigo:{name:'Oscuro',grim:'sacrificio',noHeal:true,passive:'Corrupto: solo se cura robando vida, y cuanta menos vida tiene, más roba (hasta el 20 % del daño). Cada golpe le cuesta el 2 % de su vida y hace +60 % de daño a los jefes'},
      }},
      // Evolución 2: mejora la pasiva de clase (base) y añade un efecto nuevo; se suma a la pasiva de la evolución 1
      {lvl:300, pending:true, cost:{ess:5,gold:400000,ev:30}, // pending: bloqueada ("próximamente"), pide Esencia de pesadilla
       bonus:{hp:0.15,atk:0.15}, classes:{
        Guerrero:{name:'Titán',base:{dmgTaken:0.925},rageCap:0.40,defDmg:1.0,passive:'Piel dura: −7,5 % de daño recibido · Furia hasta +40 % · Sus golpes suman un 100 % de su defensa como daño'},
        Mago:{name:'Hechicero del Vacío',base:{xp:1.15},burnPct:0.2,burnDur:4,burnMax:6,passive:'Erudito: +15 % de experiencia · La quemadura ignora la defensa, dura 4 s, quema más fuerte y se acumula hasta 6 veces'},
        Arquero:{name:'Ojo de Halcón',base:{spd:1.075},dblBuff:0.05,dblDur:5,dblMax:5,passive:'Pulso firme: +7,5 % de velocidad · Cada disparo doble da +5 % de daño durante 5 s (hasta +25 %)'},
        Asesino:{name:'Segador',base:{cd:0.5,cr:0.10},critStack:0.05,critStackMax:0.05,passive:'Letal: +50 % de daño crítico y +10 % de crítico · Tras un golpe sin crítico, el siguiente tiene +5 % de crítico'},
        Clerigo:{name:'Santo',base:{regen:0.0075},aura:13,auraDur:5,passive:'Fe: regenera el 0,75 % de su vida por segundo · Aura sagrada: lo que se cura se convierte en daño en área durante 5 s'},
      }},
    ],
  },
  matDrop:{from:10,to:150,c0:0.01,c1:0.05,max0:1,max1:3,sure:[50,100]}, // sure: esos jefes de élite dan 1 esencia segura la primera vez (para el Grimorio) // todos los jefes sueltan esencia del modo: 1 % (1) en la fase 10 → 5 % (1-3) en la 150 (el de la 150 se puede farmear)
  event:{ // Mazmorra (diaria): infinita, monstruos sin parar hasta que mueres; ranking por muertes; 1 entrada gratis al día, las demás con ticket
    // cada ramp.every s sube de nivel: +ramp.group monstruos por grupo, salen más a menudo (×spawn), andan más rápido (×walk) y pegan más rápido (+spd)
    // máximo maxDur s (5 min): si sigues vivo, el intento acaba ahí (simulado: nadie llega; los más fuertes del día 60 ≈ 3:30)
    dur:0, maxDur:300, ramp:{every:15, group:0.5, groupMax:12, spawn:0.95, spawnMin:0.5, walk:0.95, walkMin:0.25, spd:0.06},
    spawnEvery:1.2, walk:0.6, group:3, groupHp:2, groupGap:0.3, groupAtk:0.9, // grupos de 3 monstruos con ×2 de vida; llegan cada 0,3 s y pegan un 10 % menos
    ticketCost:100, // ticket extra en la tienda (tokens); las muertes de varios intentos del día se suman
    mat:'Emblema', pauseH:1, // pausa de 00:00 a 01:00 UTC: se terminan los intentos a medias y a la 01:00 se reparten los premios
    rivals:99, spread:0.35, rivalExtra:[0.2,0.06], rivalBase:0.84, // prob. de que un rival haga un 2º y un 3er intento; rivalBase ajusta la curva para que el jugador medio quede hacia el puesto 50
                          // rivales simulados: jugador medio de tus mismos días × dispersión
    curve:[[1,1],[2,10],[3,55],[5,141],[7,212],[10,261],[13,292],[15,310],[17,317],[20,333],[25,374],[30,404]], // [días de juego, muertes del jugador medio] (simulaciones F2P con la Mazmorra infinita; después sigue la última pendiente)
    rewards:[                                     // premio según tu puesto del día (se cobra al día siguiente)
      {to:1,em:5,ch:'mode',n:1},{to:3,em:4,ch:'mode',n:1},{to:10,em:3,ch:'silver',n:2},
      {to:25,em:2,ch:'silver',n:1},{to:50,em:1,ch:'wood',n:2},{to:100,em:1,ch:'wood',n:1}],
  },
  wboss:{ // Jefe semanal: 1 min contra un jefe inmortal; ranking semanal por daño (se suman los intentos); 1 entrada gratis a la semana, las demás con Ticket Jefe
    dur:60, rampTo:300, atkMult:2,                // golpea como un jefe de la fase n (n sube de 1 a rampTo durante el minuto) × atkMult
    ticketCost:150,                               // Ticket Jefe en la tienda: 150 tokens
    rivals:99, spread:0.4, rivalExtra:[0.15,0.05], rivalBase:0.75, // rivales medidos a mitad de semana; así el jugador medio queda hacia el puesto 50
    curve:[[1,2200],[2,6000],[3,13600],[5,32400],[7,70300],[10,127200],[13,191000],[15,288500],[17,458500],[20,958600],[25,1959000],[30,3131500],[35,4433500],[40,5820900],[45,7041000]], // [días de juego, daño del jugador medio en una pelea] (simulaciones F2P, 4 semillas × 5 clases)
    rewards:[                                     // premio según tu puesto de la semana (lunes 01:00 UTC)
      // ×3 del premio diario de la Mazmorra en el mismo puesto (solo hay uno por semana); los cofres de madera
      // se cambian por plata de valor parecido (2 de madera ≈ 1 de plata) para que el premio luzca
      {to:1,em:15,ch:'mode',n:3},{to:3,em:12,ch:'mode',n:3},{to:10,em:9,ch:'silver',n:6},
      {to:25,em:6,ch:'silver',n:3},{to:50,em:3,ch:'silver',n:3},{to:100,em:3,ch:'silver',n:2}],
  },
  // buyPct 0: el % de las compras del amigo está desactivado hasta tener pagos reales (lo da el servidor)
  referral:{link:'https://t.me/IdleAscensionTestBot/game', goalFase:50, goalSilver:3, buyPct:0, giftSilver:1}, // enlace de la mini app (t.me/<bot>/<app>); premios (los da el servidor: supabase/functions/track)
  // Liga mensual (SIMULADA: sin dinero real). Bote = 70 % de todos los tokens gastados en el mes. Se reparte entre TODOS los
  // jugadores según sus puntos del mes: 1 por token gastado, 1 por anuncio visto (≈3× lo que genera: ~0,3 tokens) y
  // 0,5 por hora de oro generado (oro ÷ lo que da 1 h farmeando tu récord). Premio en tokens ganados (retirables), el día 1 a la 01:00 UTC.
  // Mientras no haya servidor: 99 rivales que gastan rivalSpend tokens/día y juegan rivalPlay puntos/día (14 anuncios + ~14 h de oro).
  // show:false = Liga oculta por ahora (se implementará aparte); los puntos se siguen contando
  league:{show:false, share:0.7, ptsToken:1, ptsAd:1, ptsGoldHour:0.5, rivals:99, rivalSpend:50, rivalPlay:21},
  // Mantenimiento y actualizaciones obligatorias (control.js): la versión se mira en GitHub cada 'every' s; el mantenimiento, al abrir/volver a la app y, con la clave pública, al instante
  control:{every:300, maintEvery:15},
  supabase:{url:'https://xdtxdaywotkppzssrjni.supabase.co', key:'sb_publishable_60pnk9ALWaV_ks2oAJ7TnA_IFHSG5qH'}, // key: clave pública (publishable/anon) para el aviso en directo
  server:{url:'https://xdtxdaywotkppzssrjni.supabase.co/functions/v1/track', every:10, saveEvery:120}, // saveEvery: subir la partida cada 2 min (lleva los eventos) // base de datos: dirección de la función "track" de Supabase (vacía = no se envía nada); envía como mucho cada 10 s
  devTools:false, // herramientas de prueba (velocidad, +oro, avanzar día…): poner a false al publicar en Telegram
  phaseCap:150, // cada modo tiene 150 fases; tras vencer la 150 y evolucionar se pasa al siguiente modo
  modes:[ // upPer: mejoras de Vida/Defensa que gana de media el jugador por fase en ese modo (números pequeños: baja el ataque enemigo; estimado, recalibrar al desbloquear)
          // locked: modo bloqueado ("Próximamente"): no se puede entrar aunque se cumplan los requisitos
          // enemigos: empiezan en los de la fase 150 del modo anterior × hpStart/atkStart y crecen hpG/atkG por fase · off: oro, experiencia y cofres continúan desde la fase off · gold: multiplicador de oro · mat: material propio (uso por definir)
    {name:'Normal',off:0,gold:1,mat:'Esencia'},
    {name:'Pesadilla',locked:true,off:149,gold:1.5,mat:'Esencia de pesadilla',hpStart:2.2,atkStart:1.6,hpG:1.019,atkG:1.013,upPer:0.5,
      walls:{50:{hp:2.5,atk:1.95},100:{hp:2.3,atk:1.8},150:{hp:2.1,atk:1.7}}},
    {name:'Infierno',locked:true,off:298,gold:2.25,mat:'Esencia infernal',hpStart:2.2,atkStart:1.6,hpG:1.019,atkG:1.013,upPer:0.5,
      walls:{50:{hp:2.5,atk:1.95},100:{hp:2.3,atk:1.8},150:{hp:2.1,atk:1.7}}},
  ],
  delays:{wave:0.25,fase:0.4,defeat:0.7}, // segundos de juego entre oleadas / fases / tras perder
  offlineMinMeasure:30, // sin conexión: se usa el DPS medido cuando ya se han medido ataques por valor de 30 golpes de tu daño
  offlineCapH:3, offlineVipH:8, offlineAdMult:1.5, offlineAdPerDay:2, // horas de farmeo sin conexión (VIP); extra de oro con anuncio al llenar el tope, 2 veces por día
  cardGold:0.2, cardPrice:500, vipSpeed:1.5, vipPrice:1000, // Tarjeta mensual (+20 % de oro) y VIP (combate ×1,5, 8 h sin conexión), 30 días, en tokens
};
/* ---------- Fórmulas de los cofres ----------
   PROGRESIÓN (madera y plata, jugador sin pagar). En cada tramo hay una rareza objetivo T que hay que subir de nv1 a nv5:
   eso son 11 armas de TU clase (1 + 1+2+3+4 para forjar). Solo 1 de cada 5 armas es de tu clase.
     armas propias de T al día = η · 1/5 · (plata/día + ρ · madera/día) · p_T
     → p_T(plata) = 11 / (η · 1/5 · días · (plata/día + ρ · madera/día))        p_T(madera) = ρ · p_T(plata)
   'días' = en cuántos días debe completarse T nv5 dentro del tramo. η = aprovechamiento real de las copias (medido: 0,9).
   Suerte: probabilidad de ver al menos 1 arma propia de la rareza SIGUIENTE en el tramo → p_T+1 = −ln(1 − suerte) / (1/5 · días · (S + ρ·W)).
   El resto va a la rareza anterior (se desmonta para chatarra). Los cofres/día salen de las simulaciones (jugador medio, 4 sesiones).
   ECONOMÍA (cofre de modo, de pago). El valor de un arma se mide en 'copias de T': la siguiente rareza nv1 ≈ T nv5 = 11 copias,
   así que valor(T+k) = 11^k. Valor de un cofre de plata = Σ p · 11^k. El cofre de modo debe valer lo mismo en todos los modos:
   'itemSCE' cofres de plata por arma. Una rareza de reparto fija (fixed), la principal (main) se lleva el resto y la de premio gordo
   (jackpot) sale de: p_J = (V* − Σ fijas·valor − resto·valor_main) / (valor_J − valor_main).
   El precio del cofre de modo es fijo: 100 tokens (1 $), en chests.mode.price. */
const CHEST_PLAN={ own:1,   // parte de las armas que son de tu clase (ahora todas: los cofres solo dan armas de tu clase)
   copies:11, eta:0.9, rho:0.5, beta:11, itemSCE:12,
  // [modo, desde fase, rareza T, días, plata/día, madera/día, suerte de la rareza siguiente]
  // (Normal medido con plata comprada con oro, 10/día, y madera solo de jefes y eventos; Pesadilla e Infierno: recalibrar al desbloquearlos)
  seg:[[0,1,'C',3.3,10,3.2,0.05],[0,100,'U',8,10,1.5,0],[1,1,'R',16,8.3,3.0,0],[2,1,'E',20,9,3,0]],
  // cofre de modo por modo: rareza T (de la plata de ese modo), fijas, principal y premio gordo
  // (todas las armas son de tu clase: el cofre de modo da sobre todo la rareza del modo y a veces la siguiente)
  mode:[{T:'U',fixed:{},main:'U',jackpot:'R'},
        {T:'R',fixed:{},main:'R',jackpot:'E'},
        {T:'E',fixed:{M:0.005},main:'E',jackpot:'L'}],   // (la Mítica solo sale aquí)
};
(function buildChests(P,C){
  const R=C.rar, idx=r=>R.indexOf(r), r2=x=>Math.round(x*1000)/10;       // % con un decimal
  const vec=o=>R.map(r=>r2(o[r]||0)), fix=v=>{ const d=Math.round((100-v.reduce((a,b)=>a+b,0))*10)/10, k=v.indexOf(Math.max(...v)); v[k]=Math.round((v[k]+d)*10)/10; return v }; // suma exacta 100
  const wood=[[],[],[]], silver=[[],[],[]], mode=[], sceS=[];
  for(const [m,from,T,days,S,W,luck] of P.seg){
    const den=P.own*days*(S+P.rho*W), t=idx(T), pT=Math.min(1,P.copies/(P.eta*den)), pN=t<R.length-1?-Math.log(1-luck)/den:0;
    const mk=k=>{ const o={}; o[R[t+1]]=pN*k; o[T]=Math.min(1-pN*k,pT*k); if(t>0) o[R[t-1]]=(o[R[t-1]]||0)+1-o[T]-pN*k; else o[T]=1-pN*k; return fix(vec(o)) };
    silver[m].push([from,mk(1)]); wood[m].push([from,mk(P.rho)]);
    const sv=mk(1); sceS[m]=R.reduce((a,r,i)=>a+sv[i]/100*Math.pow(P.beta,i-t),0);   // valor de 1 plata en copias de T (último tramo del modo)
  }
  P.mode.forEach((M,m)=>{ const t=idx(M.T), val=r=>Math.pow(P.beta,idx(r)-t), V=P.itemSCE*sceS[m];
    let fs=0, fv=0; for(const r in M.fixed){ fs+=M.fixed[r]; fv+=M.fixed[r]*val(r); }
    const pJ=Math.max(0,(V-fv-(1-fs)*val(M.main))/(val(M.jackpot)-val(M.main))), o={...M.fixed}; o[M.jackpot]=(o[M.jackpot]||0)+pJ; o[M.main]=(o[M.main]||0)+1-fs-pJ;
    mode.push([[1,fix(vec(o))]]); });
  C.chests.wood.odds=wood; C.chests.silver.odds=silver; C.chests.mode.odds=mode;
  C.chestPlan=P;
})(CHEST_PLAN,CFG);
root.CFG=CFG;
if(typeof module!=='undefined'&&module.exports) module.exports=CFG;
})(typeof window!=='undefined'?window:globalThis);
