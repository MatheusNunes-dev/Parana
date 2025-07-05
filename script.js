const width = 960;
const height = 720;

const svg = d3.select("#map")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "100%")
    .style("display", "block");




    
// Projeção e path
const projection = d3.geoMercator()
  .scale(8000)
  .center([-51.5, -24.5])
  .translate([width / 2, height / 2]);
  

const path = d3.geoPath()
    .projection(projection);
    

// Tooltip simples
const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("position", "absolute")
  .style("padding", "8px")
  .style("background", "white")
  .style("border", "1px solid #ccc")
  .style("border-radius", "4px")
  .style("pointer-events", "none")
  .style("opacity", 0);

// Cores por DDD
const colorScale = d3.scaleOrdinal()
  .domain(["41", "42", "43", "44", "45", "46", "49"])
  .range(["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3", "#a6d854", "#ffd92f", "#e5c494"]);

// Função para normalizar nomes de cidades
function normalizarNome(nome) {
  return nome.trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9\s]/g, '') // Remove caracteres especiais
    .replace(/\s+/g, ' '); // Normaliza espaços
}

Promise.all([
  d3.json("mapa.topojson"),
  d3.text("dados.csv"), // Carrega como texto primeiro
  d3.dsv(";", "ddds.csv")
]).then(([topoData, dadosText, dddData]) => {
  
  // Processa o CSV de população manualmente
  const linhas = dadosText.split('\n');
  const populacaoData = [];
  
  // Encontra onde começam os dados reais (após as linhas de cabeçalho)
  let iniciodados = 0;
  for (let i = 0; i < linhas.length; i++) {
    if (linhas[i].includes('Município [-];Código [-]')) {
      iniciodados = i + 1;
      break;
    }
  }
  
  // Processa as linhas de dados
  for (let i = iniciodados; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    if (linha && !linha.startsWith(';')) {
      const campos = linha.split(';');
      if (campos.length >= 6) {
        populacaoData.push({
          municipio: campos[0],
          codigo: campos[1],
          populacao: campos[5]
        });
      }
    }
  }
  
  // Verifica se o TopoJSON tem a estrutura esperada
  console.log('Estrutura do TopoJSON:', Object.keys(topoData.objects));
  
  // Tenta diferentes possíveis nomes para o objeto de municípios
  let municipiosObj = topoData.objects.PR_Municipios_2024 || 
                     topoData.objects.municipios || 
                     topoData.objects.PR_Municipios ||
                     Object.values(topoData.objects)[0]; // Pega o primeiro objeto disponível
  
  if (!municipiosObj) {
    console.error('Não foi possível encontrar o objeto de municípios no TopoJSON');
    return;
  }
  
  const municipios = topojson.feature(topoData, municipiosObj).features;
  
  const popMap = new Map();
  const dddMap = new Map();
  const totalPorDDD = {};
  
  // Mapa de população
  populacaoData.forEach(row => {
    const codigo = row.codigo?.trim();
    const rawPop = row.populacao;
    if (codigo && rawPop) {
      const pop = parseInt(rawPop.replace(/\./g, "").replace(",", ".")) || 0;
      popMap.set(codigo, pop);
    }
  });
  
  // Mapa de DDDs
  dddData.forEach(row => {
    const cidade = row["CIDADE"];
    const ddd = row["DDD"];
    if (cidade && ddd) {
      const nomeCidade = normalizarNome(cidade);
      dddMap.set(nomeCidade, ddd);
    }
  });
  
  // Debug: mostra alguns exemplos de correspondência
  console.log('Exemplos de DDDs:', Array.from(dddMap.entries()).slice(0, 5));
  
  // Junta tudo nos municípios
  municipios.forEach(d => {
    const nome = d.properties.NM_MUN || d.properties.NAME || d.properties.nome;
    const codigo = d.properties.CD_MUN || d.properties.CODE || d.properties.codigo;
    
    if (!nome || !codigo) {
      console.warn('Propriedades não encontradas:', d.properties);
      return;
    }
    
    const nomeNormalizado = normalizarNome(nome);
    const pop = popMap.get(codigo) || 0;
    const ddd = dddMap.get(nomeNormalizado) || "N/A";
    
    d.properties.populacao = pop;
    d.properties.ddd = ddd;
    
    if (!totalPorDDD[ddd]) totalPorDDD[ddd] = 0;
    totalPorDDD[ddd] += pop;
  });
  
  // Debug: mostra estatísticas
  console.log('Total por DDD:', totalPorDDD);
  console.log('Municípios processados:', municipios.length);
  
  // Desenha os municípios
  svg.selectAll("path")
    .data(municipios)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", d => {
      const cor = colorScale(d.properties.ddd);
      return cor || "#ccc";
    })
    .attr("stroke", "#000")
    .attr("stroke-width", 1.5)
    .on("mouseover", (event, d) => {
      tooltip.transition().duration(200).style("opacity", 1);
      tooltip.html(`<strong>${d.properties.NM_MUN || d.properties.NAME}</strong><br>
                   DDD: ${d.properties.ddd}<br>
                   População: ${d.properties.populacao.toLocaleString()}`)
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", () => {
      tooltip.transition().duration(200).style("opacity", 0);
    });
  
  // Legenda
  const legenda = d3.select("#legenda")
    .append("ul")
    .style("list-style", "none")
    .style("padding", 0);
  
  Object.entries(totalPorDDD)
    .filter(([ddd]) => ddd !== "N/A")
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([ddd, total]) => {
      legenda.append("li")
        .style("margin-bottom", "4px")
        .html(`<span style="background:${colorScale(ddd)};display:inline-block;width:20px;height:20px;margin-right:8px;"></span>DDD ${ddd}: ${total.toLocaleString()} pessoas`);
    });

}).catch(error => {
  console.error("Erro carregando dados:", error);
});


