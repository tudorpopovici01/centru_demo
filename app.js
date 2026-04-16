// CONFIGURARE
const SB_URL = 'https://cberaogpfktqgneybgth.supabase.co'; 
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNiZXJhb2dwZmt0cWduZXliZ3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTYwMjIsImV4cCI6MjA5MTczMjAyMn0.G_xWmtStXaJsn_BrMflAvjcPvMbfJyK26ibRGr-C5T0'; 

// REPARARE: Folosim createClient din obiectul global supabase
const _supabase = supabase.createClient(SB_URL, SB_KEY);

// 2. NAVIGARE ȘI AFIȘARE PAGINI
window.showPage = (id) => {
    document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0,0);
};

// 3. REPROSPĂTARE DATE DIN CLOUD
async function refreshData() {
    const { data: stoc } = await _supabase.from('stoc').select('*').order('nume');
    const { data: consum } = await _supabase.from('consum').select('*').order('data', {ascending: false});
    
    renderTables(stoc || [], consum || []);
    populateSelect(stoc || []);
}

// 4. LOGICĂ STOC (ADĂUGARE / ACTUALIZARE)
document.getElementById('formPrimite').addEventListener('submit', async (e) => {
    e.preventDefault();
    const idEdit = document.getElementById('edit_id').value;
    const q = Number(document.getElementById('p_cantitate').value);
    
    const produs = {
        p_id: document.getElementById('p_id').value,
        nume: document.getElementById('p_nume').value,
        furnizor: document.getElementById('p_furnizor').value,
        data: document.getElementById('p_data').value,
        data_producere: document.getElementById('p_producere').value,
        data_expirare: document.getElementById('p_expirare').value,
        cantitate: q,
        ramas: q, // La editare se resetează stocul la noua cantitate
        um: document.getElementById('p_um').value,
        pret: Number(document.getElementById('p_pret').value)
    };

    if(idEdit) {
        await _supabase.from('stoc').update(produs).eq('id', idEdit);
    } else {
        await _supabase.from('stoc').insert([produs]);
    }

    anuleazaEditarea();
    refreshData();
});

// 5. EDITARE ȘI ȘTERGERE PRODUS
window.incarcaPentruEditare = (p) => {
    document.getElementById('edit_id').value = p.id;
    document.getElementById('p_id').value = p.p_id;
    document.getElementById('p_nume').value = p.nume;
    document.getElementById('p_furnizor').value = p.furnizor;
    document.getElementById('p_data').value = p.data;
    document.getElementById('p_producere').value = p.data_producere;
    document.getElementById('p_expirare').value = p.data_expirare;
    document.getElementById('p_cantitate').value = p.cantitate;
    document.getElementById('p_um').value = p.um;
    document.getElementById('p_pret').value = p.pret;
    
    document.getElementById('btn-submit-stoc').innerText = "Actualizează";
    document.getElementById('btn-cancel-edit').style.display = "inline";
    window.scrollTo(0,0);
};

window.anuleazaEditarea = () => {
    document.getElementById('formPrimite').reset();
    document.getElementById('edit_id').value = "";
    document.getElementById('btn-submit-stoc').innerText = "Salvează în Stoc";
    document.getElementById('btn-cancel-edit').style.display = "none";
};

window.deleteProdus = async (id) => {
    if(confirm("Ștergi definitiv produsul?")) {
        await _supabase.from('stoc').delete().eq('id', id);
        refreshData();
    }
};

// 6. LOGICĂ CONSUM (SCĂDERE ȘI SALVARE)
document.getElementById('formConsum').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p_id_manual = document.getElementById('c_id').value;
    const q_ceruta = Number(document.getElementById('c_cantitate').value);
    
    const { data: p } = await _supabase.from('stoc').select('*').eq('p_id', p_id_manual).single();

    if(p && Number(p.ramas) >= q_ceruta) {
        // Scădem din stoc
        await _supabase.from('stoc').update({ ramas: p.ramas - q_ceruta }).eq('p_id', p_id_manual);
        
        // Înregistrăm consumul
        await _supabase.from('consum').insert([{
            id_produs: p_id_manual,
            nume: p.nume,
            data: document.getElementById('c_data').value,
            masa: document.getElementById('c_masa').value,
            fel_mancare: document.getElementById('c_fel').value,
            cantitate: q_ceruta,
            persoane: document.getElementById('c_persoane').value
        }]);

        e.target.reset();
        refreshData();
    } else {
        alert("Stoc insuficient!");
    }
});

// 7. ANULARE CONSUM (REFACERE STOC)
window.stergeConsum = async (id_db, p_id_manual, q_de_returnat) => {
    if(confirm("Anulezi acest consum? Cantitatea va reveni în stoc.")) {
        const { data: p } = await _supabase.from('stoc').select('ramas').eq('p_id', p_id_manual).single();
        if(p) {
            await _supabase.from('stoc').update({ ramas: Number(p.ramas) + Number(q_de_returnat) }).eq('p_id', p_id_manual);
            await _supabase.from('consum').delete().eq('id', id_db);
            refreshData();
        }
    }
};

// 8. AFIȘARE TABELE
function renderTables(stoc, consum) {
    const azi = new Date();
    const limita = new Date(); limita.setDate(azi.getDate() + 3);

    // Tabel STOC
    document.querySelector('#tabelStoc tbody').innerHTML = stoc.map(p => {
        const dExp = new Date(p.data_expirare);
        const clasa = dExp < azi ? 'class="expirat-red"' : (dExp <= limita ? 'class="expira-curand-yellow"' : '');
        return `
            <tr ${clasa}>
                <td>${p.p_id}</td>
                <td>${p.nume}</td>
                <td>${p.furnizor || '-'}</td>
                <td>${p.data}</td>
                <td>${p.data_producere || '-'}</td>
                <td>${p.data_expirare}</td>
                <td>${p.cantitate} ${p.um}</td>
                <td>${p.ramas.toFixed(2)} ${p.um}</td>
                <td>${p.pret}</td>
                <td>${(p.ramas * p.pret).toFixed(2)}</td>
                <td>
                    <button onclick='incarcaPentruEditare(${JSON.stringify(p)})'>Edit</button>
                    <button class="btn-delete" onclick="deleteProdus(${p.id})">X</button>
                </td>
            </tr>`;
    }).join('');

    // Tabel CONSUM
    document.querySelector('#tabelConsum tbody').innerHTML = consum.map(c => `
        <tr>
            <td>${c.data}</td>
            <td>${c.masa}</td>
            <td>${c.fel_mancare}</td>
            <td>${c.nume}</td>
            <td>${c.cantitate}</td>
            <td>${c.persoane || '-'}</td>
            <td><button class="btn-delete" onclick="stergeConsum(${c.id},'${c.id_produs}',${c.cantitate})">X</button></td>
        </tr>`).join('');
}

// 9. RAPOARTE ȘI EXCEL
window.genereazaRaportTabelar = async () => {
    const { data: stoc } = await _supabase.from('stoc').select('*');
    const { data: consum } = await _supabase.from('consum').select('*');

    // 🟨 ANTET OFICIAL (ca în formular)
    document.getElementById('antet-raport').innerHTML = `
        <div style="text-align:right; font-size:11px;">
            Aprobat prin ordinul<br>
            Ministerului Finanțelor<br>
            nr. 216 din 28.12.2015
        </div>

        <h3 style="text-align:center; margin-top:10px;">
            SITUAȚIE CUMULATIVĂ PRIVIND<br>
            CONSUMUL DE PRODUSE ALIMENTARE
        </h3>

        <p style="text-align:center;">
            Luna: __________
        </p>
    `;

    let h = `
    <thead>
        <tr>
            <th rowspan="2">Denumirea produselor</th>
            <th rowspan="2">UM</th>
            <th colspan="31">Zilele lunii</th>
            <th rowspan="2">Sold început</th>
            <th rowspan="2">Total primit</th>
            <th rowspan="2">Consum total</th>
            <th rowspan="2">Stoc rămas</th>
            <th rowspan="2">Preț</th>
            <th rowspan="2">Total consum (lei)</th>
            <th rowspan="2">Total rămas</th>
        </tr>
        <tr>
    `;

    for (let i = 1; i <= 31; i++) {
        h += `<th>${i}</th>`;
    }

    h += `</tr></thead><tbody>`;

    let totalGeneralConsum = 0;
    let totalGeneralRamas = 0;

    stoc.forEach(p => {
        let consumTotal = 0;
        let consumZilnic = Array(31).fill(0);

        consum
            .filter(c => c.id_produs === p.p_id)
            .forEach(c => {
                const zi = new Date(c.data).getDate() - 1;
                consumZilnic[zi] += Number(c.cantitate);
            });

        let rand = `<tr><td style="text-align:left">${p.nume}</td><td>${p.um}</td>`;

        consumZilnic.forEach(val => {
            rand += `<td>${val ? val.toFixed(2) : ''}</td>`;
            consumTotal += val;
        });

        const soldInitial = Number(p.cantitate || 0);
        const totalPrimit = Number(p.cantitate || 0);
        const stocFinal = Number(p.ramas || 0);
        const pret = Number(p.pret || 0);

        const totalConsumLei = consumTotal * pret;
        const totalRamasLei = stocFinal * pret;

        totalGeneralConsum += totalConsumLei;
        totalGeneralRamas += totalRamasLei;

        rand += `
            <td>${soldInitial.toFixed(2)}</td>
            <td>${totalPrimit.toFixed(2)}</td>
            <td><b>${consumTotal.toFixed(2)}</b></td>
            <td>${stocFinal.toFixed(2)}</td>
            <td>${pret.toFixed(2)}</td>
            <td>${totalConsumLei.toFixed(2)}</td>
            <td>${totalRamasLei.toFixed(2)}</td>
        `;

        rand += `</tr>`;
        h += rand;
    });

    // 🟩 TOTAL GENERAL (foarte important)
    h += `
        <tr style="background:#ddd; font-weight:bold;">
            <td colspan="36">TOTAL GENERAL</td>
            <td>${totalGeneralConsum.toFixed(2)}</td>
            <td>${totalGeneralRamas.toFixed(2)}</td>
        </tr>
    `;

    h += `</tbody>`;
    document.getElementById('tabelRezultatRaport').innerHTML = h;
};
window.genereazaMeniuComanda = async () => {
    const dataA = prompt("Introdu data (AAAA-LL-ZZ):", new Date().toISOString().split('T')[0]);
    if(!dataA) return;
    const { data: consum } = await _supabase.from('consum').select('*').eq('data', dataA);
    
    document.getElementById('antet-raport').innerHTML = `<h2>MENIU COMANDĂ - DATA: ${dataA}</h2>`;
    let h = '<thead><tr><th>Masa</th><th>Fel Mâncare</th><th>Ingredient</th><th>Cantitate</th></tr></thead><tbody>';
    if(consum && consum.length > 0) {
        consum.forEach(c => h += `<tr><td>${c.masa}</td><td>${c.fel_mancare}</td><td>${c.nume}</td><td>${Number(c.cantitate).toFixed(3)}</td></tr>`);
    } else {
        h += '<tr><td colspan="4">Nu există date.</td></tr>';
    }
    document.getElementById('tabelRezultatRaport').innerHTML = h + '</tbody>';
};

window.exportExcel = (id, nume) => {
    const table = document.getElementById(id);
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `${nume}_${new Date().toLocaleDateString()}.xlsx`);
};

// 10. INIȚIALIZARE
function populateSelect(stoc) {
    document.getElementById('c_id').innerHTML = '<option value="">Selectează Ingredient</option>' + 
        stoc.map(p => `<option value="${p.p_id}">${p.nume} (Rămas: ${p.ramas} ${p.um})</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    refreshData();
    // Setăm data de azi în formulare
    const azi = new Date().toISOString().split('T')[0];
    document.getElementById('p_data').value = azi;
    document.getElementById('c_data').value = azi;
});
