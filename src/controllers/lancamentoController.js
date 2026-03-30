// src/controllers/lancamentoController.js
import { encrypt, decrypt } from '../service/cryptoService.mjs'; 
import * as LancamentoModel from '../models/lancamentoModel.mjs';

/**
 * 1. ROTA POST: Criptografa e Salva
 */
export const postLancamento = async (req, res) => {
  try {
    const { escritorio_id, tipo, status, data_vencimento, valor, descricao } = req.body;

    // Validação básica de entrada
    if (!valor || !descricao || !escritorio_id) {
      return res.status(400).json({ 
        success: false, 
        error: "Escritório ID, valor e descrição são obrigatórios." 
      });
    }

    // Criptografando os dados sensíveis (O cryptoService retorna Buffers)
    const vCripto = encrypt(valor.toString());
    const dCripto = encrypt(descricao);

    // Salvando no banco através do Model
    const novoLancamento = await LancamentoModel.createLancamento({
      escritorio_id,
      tipo,
      status: status || 'PENDENTE',
      data_vencimento,
      valor_encrypted: vCripto.encrypted,
      valor_iv: vCripto.iv,
      valor_tag: vCripto.tag,
      descricao_encrypted: dCripto.encrypted,
      descricao_iv: dCripto.iv,
      descricao_tag: dCripto.tag
    });

    res.status(201).json({ 
      success: true, 
      message: "Lançamento salvo com criptografia AES-256-GCM!", 
      id: novoLancamento.id 
    });

  } catch (error) {
    console.error("❌ Erro no postLancamento:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao processar dados ou salvar no banco." 
    });
  }
};

/**
 * 2. ROTA GET: Busca e Descriptografa
 */
export const getLancamentos = async (req, res) => {
  try {
    const { escritorio_id } = req.params;

    if (!escritorio_id) {
      return res.status(400).json({ error: "ID do escritório não fornecido." });
    }

    // Busca os lançamentos criptografados no banco
    const result = await LancamentoModel.getLancamentosByEscritorio(escritorio_id);

    // Processa cada item descriptografando os campos
    const lancamentosProcessados = result.map(item => {
      try {
        return {
          id: item.id,
          escritorio_id: item.escritorio_id,
          tipo: item.tipo,
          status: item.status,
          data_vencimento: item.data_vencimento,
          // Descriptografia real acontecendo aqui
          valor: decrypt(item.valor_encrypted, item.valor_iv, item.valor_tag),
          descricao: decrypt(item.descricao_encrypted, item.descricao_iv, item.descricao_tag)
        };
      } catch (decErr) {
        console.error(`Erro ao descriptografar item ${item.id}:`, decErr.message);
        return { ...item, erro: "Falha na descriptografia deste registro." };
      }
    });

    res.json(lancamentosProcessados);

  } catch (error) {
    console.error("❌ Erro no getLancamentos:", error);
    res.status(500).json({ error: "Erro ao buscar e descriptografar lançamentos." });
  }
};