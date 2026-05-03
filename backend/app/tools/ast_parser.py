# app/tools/ast_parser.py
from app.tools.registry import register
import json

async def code_to_tree(file_path: str, code_content: str) -> dict:
    """
    Mensimulasikan pemanggilan ke server tree-sitter.
    Menerjemahkan string kode mentah menjadi hierarki AST struktural.
    """
    # Implementasi asli akan mengurai AST di sini.
    # Simulasi kembalian JSON struktural
    simulated_ast = {
        "type": "Program",
        "body": [
            {
                "type": "FunctionDeclaration",
                "id": {"name": "calculateTotal"},
                "params": [{"name": "items"}],
                "loc": {"start": {"line": 1, "column": 0}, "end": {"line": 5, "column": 1}}
            }
        ]
    }
    return simulated_ast

register("code_to_tree", code_to_tree)