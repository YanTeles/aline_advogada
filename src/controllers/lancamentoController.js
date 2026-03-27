// Atenção: verifique se sua pasta chama 'service' ou 'services'
import { encrypt } from '../service/cryptoService.mjs'; 
import * as LancamentoModel from '../models/lancamentoModel.mjs';

export const postLancamento = async (req, res) => {
  try {
    const { escritorio_id, tipo, status, data_vencimento, valor, descricao } = req.body;

    // Criptografando antes de enviar para o banco
    const vCripto = encrypt(valor.toString());
    const dCripto = encrypt(descricao);

    const novoLancamento = await LancamentoModel.createLancamento({
      escritorio_id,
      tipo,
      status,
      data_vencimento,
      valor_encrypted: vCripto.encryptedData,
      valor_iv: vCripto.iv,
      valor_tag: vCripto.tag,
      descricao_encrypted: dCripto.encryptedData,
      descricao_iv: dCripto.iv,
      descricao_tag: dCripto.tag
    });

    res.status(201).json({ 
      success: true, 
      message: "Lançamento salvo com criptografia!", 
      id: novoLancamento.id 
    });
  } catch (error) {
    console.error("Erro no Controller:", error);
    res.status(500).json({ success: false, error: "Erro interno ao salvar." });
  }
};