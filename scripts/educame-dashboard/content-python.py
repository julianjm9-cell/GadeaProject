"""Extract literal educational fields without importing or running product code."""
import ast
import json
import sys

data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
source = data["source"]
lines = source.splitlines(keepends=True)
starts = [0]
for line in lines:
    starts.append(starts[-1] + len(line))
fields = []
content_keys = {"title", "name", "text", "body", "content", "prompt", "question", "answer", "solution", "correct", "explanation", "why", "hint", "clue", "brief", "story", "description", "objective", "summary", "example", "options", "answers", "choices", "steps", "items", "pairs", "rows", "terms", "definitions", "accepted", "alternatives", "concepts", "examples", "tips", "rules", "notes", "meaning", "word", "sentence", "translation", "left", "right", "q", "a", "b", "es", "en"}
technical = {"id", "slug", "type", "kind", "key", "image", "icon", "src", "url", "href", "path", "code", "password", "token"}


def offset(line, column):
    index = starts[line - 1] + len(lines[line - 1].encode("utf-8")[:column].decode("utf-8"))
    return len(source[:index].encode("utf-16-le")) // 2


def walk(node, trail, context=None, key="", allowed=False):
    if isinstance(node, ast.JoinedStr):
        return
    if isinstance(node, ast.Dict):
        pairs = [(k.value, v) for k, v in zip(node.keys, node.values) if isinstance(k, ast.Constant) and isinstance(k.value, str)]
        title = next((v.value for k, v in pairs if k in {"title", "name", "prompt", "question"} and isinstance(v, ast.Constant) and isinstance(v.value, str)), None)
        if title:
            context = (trail, title)
        for name, child in pairs:
            if name not in technical and not name.endswith(("_id", "Id", "Ids")):
                walk(child, trail + "/" + name, context, name, allowed or name in content_keys)
        return
    if isinstance(node, (ast.List, ast.Tuple)):
        context = context or (trail, key or "Contenido")
        for index, child in enumerate(node.elts):
            walk(child, trail + "/" + str(index), context, key, allowed)
        return
    if isinstance(node, ast.Constant) and context and allowed and type(node.value) in {str, int, float, bool}:
        value = node.value
        if isinstance(value, str) and (not value.strip() or len(value) > 30000 or value.startswith(("http://", "https://", "/api/", "/assets/"))):
            return
        if not isinstance(value, str) and key not in {"correct", "answer", "solution"}:
            return
        fields.append({"group": context[0], "title": context[1], "key": trail, "label": key + " · " + "/".join(trail.split("/")[-2:]), "value": value, "start": offset(node.lineno, node.col_offset), "end": offset(node.end_lineno, node.end_col_offset), "format": "python"})
        return
    if isinstance(node, (ast.Assign, ast.AnnAssign)):
        target = node.targets[0] if isinstance(node, ast.Assign) else node.target
        name = target.id if isinstance(target, ast.Name) else key
        walk(node.value, trail + "/" + name, context, name, name.lower() in content_keys)
        return
    for index, child in enumerate(ast.iter_child_nodes(node)):
        walk(child, trail + "/" + str(index), context, key, allowed)


try:
    walk(ast.parse(source), "python")
    print(json.dumps({"fields": fields, "diagnostics": []}, ensure_ascii=True))
except SyntaxError as error:
    print(json.dumps({"fields": [], "diagnostics": [str(error)]}))
