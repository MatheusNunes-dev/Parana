// Dados dos municípios (carregados dos CSVs)
let municipiosData = [];

// Estado da aplicação
let currentData = [];
let currentPage = 1;
let itemsPerPage = 10;
let currentView = 'table';

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    loadDataFromCSV();
    setupEventListeners();
});

// Função para carregar dados dos CSVs
async function loadDataFromCSV() {
    try {
        // Carrega os dados do CSV de municípios
        const response = await fetch('dados.csv');
        const csvText = await response.text();
        
        // Processa o CSV manualmente
        const lines = csvText.split('\n');
        let startIndex = 0;
        
        // Encontra onde começam os dados reais
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('Município [-];Código [-]')) {
                startIndex = i + 1;
                break;
            }
        }
        
        // Processa as linhas de dados
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith(';')) {
                const fields = line.split(';');
                if (fields.length >= 14) {
                    const municipio = {
                        municipio: fields[0] || '',
                        codigo: fields[1] || '',
                        gentilico: fields[2] || '',
                        prefeito: fields[3] || '',
                        area: parseFloat(fields[4]?.replace(',', '.')) || 0,
                        populacao: parseInt(fields[5]?.replace(/\./g, '')) || 0,
                        densidade: parseFloat(fields[6]?.replace(',', '.')) || 0,
                        populacaoEstimada: parseInt(fields[7]?.replace(/\./g, '')) || 0,
                        escolarizacao: parseFloat(fields[8]?.replace(',', '.')) || 0,
                        idhm: parseFloat(fields[9]?.replace(',', '.')) || 0,
                        mortalidadeInfantil: fields[10] || '-',
                        receitasBrutas: parseFloat(fields[11]?.replace(/\./g, '').replace(',', '.')) || 0,
                        despesasBrutas: parseFloat(fields[12]?.replace(/\./g, '').replace(',', '.')) || 0,
                        pibPerCapita: parseFloat(fields[13]?.replace(/\./g, '').replace(',', '.')) || 0
                    };
                    
                    // Só adiciona se tem dados válidos
                    if (municipio.municipio && municipio.codigo) {
                        municipiosData.push(municipio);
                    }
                }
            }
        }
        
        // Tenta carregar dados de DDDs também
        try {
            const dddResponse = await fetch('ddds.csv');
            const dddText = await dddResponse.text();
            const dddLines = dddText.split('\n');
            const dddMap = new Map();
            
            // Processa DDDs
            for (let i = 1; i < dddLines.length; i++) {
                const line = dddLines[i].trim();
                if (line) {
                    const fields = line.split(';');
                    if (fields.length >= 4) {
                        const cidade = fields[2]?.trim().toLowerCase();
                        const ddd = fields[3]?.trim();
                        if (cidade && ddd) {
                            dddMap.set(cidade, ddd);
                        }
                    }
                }
            }
            
            // Adiciona DDDs aos municípios
            municipiosData.forEach(municipio => {
                const nomeLower = municipio.municipio.toLowerCase();
                municipio.ddd = dddMap.get(nomeLower) || 'N/A';
            });
            
        } catch (error) {
            console.warn('Não foi possível carregar dados de DDD:', error);
        }
        
        console.log(`Carregados ${municipiosData.length} municípios`);
        currentData = [...municipiosData];
        
        // Inicializa a interface
        initializeApp();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        showErrorMessage('Erro ao carregar dados dos municípios. Verifique se os arquivos CSV estão disponíveis.');
    }
}

function showErrorMessage(message) {
    const container = document.querySelector('.container');
    container.innerHTML = `
        <div class="header">
            <h1>⚠️ Erro</h1>
            <p>${message}</p>
        </div>
        <div style="padding: 30px; text-align: center;">
            <p>Certifique-se de que os arquivos <strong>dados.csv</strong> e <strong>ddds.csv</strong> estão no mesmo diretório do HTML.</p>
            <p>Caso esteja testando localmente, você pode precisar executar um servidor HTTP simples.</p>
        </div>
    `;
}

function initializeApp() {
    updateStats();
    renderTable();
    renderPagination();
}

function setupEventListeners() {
    // Busca
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Ordenação
    document.getElementById('sortSelect').addEventListener('change', handleSort);
    
    // Alternar visualização
    document.getElementById('tableView').addEventListener('click', () => switchView('table'));
    document.getElementById('cardView').addEventListener('click', () => switchView('cards'));
}

function updateStats() {
    const stats = calculateStats();
    const statsGrid = document.getElementById('statsGrid');
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${stats.totalMunicipios}</div>
            <div class="stat-label">Municípios</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${formatNumber(stats.populacaoTotal)}</div>
            <div class="stat-label">População Total</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${formatNumber(stats.areaTotal)}</div>
            <div class="stat-label">Área Total (km²)</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${stats.idhmMedio}</div>
            <div class="stat-label">IDHM Médio</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">R$ ${formatNumber(stats.pibMedio)}</div>
            <div class="stat-label">PIB per capita Médio</div>
        </div>
    `;
}

function calculateStats() {
    const totalMunicipios = currentData.length;
    const populacaoTotal = currentData.reduce((sum, m) => sum + m.populacao, 0);
    const areaTotal = currentData.reduce((sum, m) => sum + m.area, 0);
    const idhmMedio = (currentData.reduce((sum, m) => sum + m.idhm, 0) / totalMunicipios).toFixed(3);
    const pibMedio = (currentData.reduce((sum, m) => sum + m.pibPerCapita, 0) / totalMunicipios).toFixed(2);
    
    return {
        totalMunicipios,
        populacaoTotal,
        areaTotal: areaTotal.toFixed(2),
        idhmMedio,
        pibMedio
    };
}

function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    
    if (searchTerm === '') {
        currentData = [...municipiosData];
    } else {
        currentData = municipiosData.filter(municipio =>
            municipio.municipio.toLowerCase().includes(searchTerm) ||
            municipio.prefeito.toLowerCase().includes(searchTerm) ||
            municipio.gentilico.toLowerCase().includes(searchTerm)
        );
    }
    
    currentPage = 1;
    updateStats();
    renderCurrentView();
    renderPagination();
}

function handleSort(event) {
    const sortBy = event.target.value;
    
    currentData.sort((a, b) => {
        switch(sortBy) {
            case 'municipio':
                return a.municipio.localeCompare(b.municipio);
            case 'populacao':
                return b.populacao - a.populacao;
            case 'area':
                return b.area - a.area;
            case 'densidade':
                return b.densidade - a.densidade;
            case 'idhm':
                return b.idhm - a.idhm;
            case 'pib':
                return b.pibPerCapita - a.pibPerCapita;
            case 'receitas':
                return b.receitasBrutas - a.receitasBrutas;
            case 'ddd':
                return a.ddd.localeCompare(b.ddd);
            default:
                return 0;
        }
    });
    
    renderCurrentView();
    renderPagination();
}

function switchView(view) {
    currentView = view;
    
    // Atualizar botões
    document.getElementById('tableView').classList.toggle('active', view === 'table');
    document.getElementById('cardView').classList.toggle('active', view === 'cards');
    
    // Mostrar/esconder containers
    document.getElementById('tableContainer').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('cardsContainer').style.display = view === 'cards' ? 'block' : 'none';
    
    renderCurrentView();
}

function renderCurrentView() {
    if (currentView === 'table') {
        renderTable();
    } else {
        renderCards();
    }
}

function renderTable() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = currentData.slice(startIndex, endIndex);
    
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = pageData.map(municipio => `
        <tr>
            <td><strong>${highlightSearch(municipio.municipio)}</strong></td>
            <td><span style="background: #e3f2fd; padding: 2px 6px; border-radius: 3px; font-size: 0.9em;">${municipio.ddd}</span></td>
            <td>${highlightSearch(municipio.prefeito)}</td>
            <td>${formatNumber(municipio.populacao)}</td>
            <td>${formatNumber(municipio.area)}</td>
            <td>${municipio.densidade}</td>
            <td>${municipio.idhm}</td>
            <td>R$ ${formatNumber(municipio.pibPerCapita)}</td>
            <td>${municipio.escolarizacao}%</td>
            <td>R$ ${formatNumber(municipio.receitasBrutas)}</td>
        </tr>
    `).join('');
}

function renderCards() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = currentData.slice(startIndex, endIndex);
    
    const cardsContainer = document.getElementById('cardsContainer');
    cardsContainer.innerHTML = pageData.map(municipio => `
        <div class="municipality-card">
            <div class="card-header">
                <div>
                    <div class="card-title">${highlightSearch(municipio.municipio)}</div>
                    <div class="card-subtitle">${highlightSearch(municipio.prefeito)}</div>
                </div>
                <div style="text-align: right;">
                    <span style="background: #e3f2fd; padding: 4px 8px; border-radius: 5px; font-size: 0.9em; color: #1976d2;">
                        DDD ${municipio.ddd}
                    </span>
                </div>
            </div>
            <div class="card-metrics">
                <div class="metric">
                    <div class="metric-value">${formatNumber(municipio.populacao)}</div>
                    <div class="metric-label">População</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${formatNumber(municipio.area)}</div>
                    <div class="metric-label">Área (km²)</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${municipio.idhm}</div>
                    <div class="metric-label">IDHM</div>
                </div>
                <div class="metric">
                    <div class="metric-value">R$ ${formatNumber(municipio.pibPerCapita)}</div>
                    <div class="metric-label">PIB per capita</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${municipio.escolarizacao}%</div>
                    <div class="metric-label">Escolarização</div>
                </div>
                <div class="metric">
                    <div class="metric-value">R$ ${formatNumber(municipio.receitasBrutas)}</div>
                    <div class="metric-label">Receitas Brutas</div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderPagination() {
    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    let paginationHTML = '';
    
    // Botão anterior
    paginationHTML += `
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            ← Anterior
        </button>
    `;
    
    // Números das páginas
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="active">${i}</button>`;
        } else if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
            paginationHTML += `<button onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += `<span>...</span>`;
        }
    }
    
    // Botão próximo
    paginationHTML += `
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Próximo →
        </button>
    `;
    
    pagination.innerHTML = paginationHTML;
}

function changePage(page) {
    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderCurrentView();
        renderPagination();
    }
}

function formatNumber(num) {
    return num.toLocaleString('pt-BR');
}

function highlightSearch(text) {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (!searchTerm) return text;
    
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<span class="highlight">$1</span>');
}