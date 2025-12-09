# Prompts

## 0. Initial prompt:

**Goal:** Build a minimal “Uncertainty Notebook” web app. The app lets users write notes, highlight text, and convert that text into simple structured uncertainty objects. Treat uncertainties and decisions as lightweight JSON records.

**Domain background (minimal):**
DRUIDE is a language for articulating design-time uncertainty. For this prototype, support only two concepts:

* **DUncertainty**: `{ id, description }`
* **DDecision**: `{ id, question, resolved: false }`
  No dependencies, no sources, no partialities. Keep it simple.

**App requirements:**

* Single-page web app with a text notebook area.
* User can select any text and click “Create Uncertainty” or “Create Decision.”
* When clicked, show a modal to confirm/edit the extracted description or question.
* Store created uncertainties/decisions in an in-memory list.
* Display all created items in a sidebar.
* Clicking an item highlights the corresponding text in the notebook (approximate mapping is fine).
* Use a clean, minimal layout and vanilla HTML/JS or a lightweight framework (your choice).

**Technical constraints:**

* Generate all necessary files: HTML, JS, CSS.
* No backend required; everything runs client-side.
* Keep the code easy to extend later.

**Overall objective:**
Produce a minimal but functional prototype that demonstrates the core interaction loop of an Uncertainty Notebook:

1. write thoughts
2. extract uncertainties or decisions
3. view and navigate them in a sidebar

This is a scaffolding for a future richer system, so clarity and simplicity matter more than completeness.

## 1. Deleting annotations

I actually don't need to run a server for this, I can just open the index.html file and it works as requested :)

thanks!

Functionalities to add:
i should be able to delete annotations (the easiest would be to do it from the extracted items column)

## 2. Supporting markdown 

Can you make it support markdown? and maybe a button in the notebook to switch from plain text to markdown?


## 3. Deciding on annotation architecture

You are upgrading the existing Markdown notebook prototype that currently highlights text by wrapping it in `<span class="highlight-uncertainty">…</span>`.
Replace this mechanism with a **footnote-based hybrid annotation system** inspired by DRUIDE.

---

**1. Core Change: Use Footnotes for Uncertainty Annotations**

When a user selects text and chooses *Mark as Uncertainty*, transform the markdown by adding a footnote reference *after the selected text*:

Example:

**Before:**

```md
This is something very cool.
```

**After:**

```md
This is something[^unc-abc123] very cool.

[^unc-abc123]: <!-- druide:uncertainty:id=abc123 -->
```

Rules:

* The reference name begins with `unc-` followed by a UUID you generate.
* The footnote definition contains a DRUIDE HTML comment, which anchors metadata.
* No spans or inline HTML in the main text.

---

**2. DRUIDE Knowledge Base (External JSON)**

Maintain a separate JSON store that records all DRUIDE annotations:

```json
{
  "abc123": {
    "type": "uncertainty",
    "text": "something",
    "question": "",
    "range": { "start": 8, "end": 17 },
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

On each edit:

* Recompute `text` by reading the token’s referenced span.
* Recompute `range`.
* Remove entries for footnotes that no longer appear.
* Add new entries when a new footnote reference is created.

---

**3. View Mode Rendering (Interactive Highlights)**

In *View mode*:

* Replace each `[^unc-id]` marker with a highlight around the referenced text.
* Hide DRUIDE footnote definitions from the rendered document.
* Show a **DRUIDE sidebar panel** listing:

  * all uncertainties
  * their questions
  * their linked text
  * clickable navigation to the text region

Rendering example:

```html
<span class="uncertainty" data-id="abc123">something</span>
```

The markdown file should remain unchanged.

---

**4. Edit Mode Rendering**

In *Edit mode*:

* Show RAW markdown with footnote markers and footnote definitions.
* Do NOT render spans or highlights.
* DRUIDE definitions at the bottom (or anywhere) remain visible.

---

**5. Footnote Filtering Modes**

Implement the following:

**Author Mode (default)**

* Show highlights in view mode.
* Sidebar shows DRUIDE annotations.

**Reader Mode (clean output)**

* Remove ALL DRUIDE footnote definitions from the rendered output.
* Remove inline markers such as `[^unc-abc123]`.
* Keep normal footnotes intact.

Result: a fully clean readable version of the document.

**DRUIDE Model View**

* Show only DRUIDE elements (uncertainties, decisions, dependencies).
* Generated from the footnotes + KB.
* Useful for exporting the uncertainty model.

---

**6. Example Transformations**

**Example 1 — Create annotation**

**Before:**

```md
I wonder how to model this part.
```

**After:**

```md
I wonder how to model[^unc-xyz789] this part.

[^unc-xyz789]: <!-- druide:uncertainty:id=xyz789 -->
```

KB entry:

```json
{
  "xyz789": {
    "type": "uncertainty",
    "text": "model",
    "range": { "start": ..., "end": ... }
  }
}
```

---

**Example 2 — Edit text but keep token**

**Before:**

```md
This is tricky[^unc-abc123].
```

**After:**

```md
This is extremely tricky[^unc-abc123].
```

KB update:

* `text = "tricky"`
* range updated accordingly

---

**Example 3 — Reader mode**

Source markdown:

```md
Something interesting[^unc-abc123].

[^unc-abc123]: <!-- druide:uncertainty -->
[^note1]: A real footnote.
```

Rendered output:

```md
Something interesting.

[^note1]: A real footnote.
```

---

**Your task**

Modify the prototype so that:

1. All uncertainty annotations use the footnote system (`[^unc-id]`).
2. All metadata is stored in an external DRUIDE knowledge base.
3. View/Edit modes behave as described.
4. Reader Mode removes DRUIDE footnotes and inline references.
5. A sidebar shows DRUIDE uncertainties with navigation.
6. Synchronization between markdown ↔ KB is robust under edits.
7. The architecture supports future DRUIDE types (decisions, dependencies, rationale).

Output clean, maintainable code that evolves the existing prototype.

## 4. Refinement of the annotation and layout

OK, a few of things:
- I want to be able to highlight text in Reader mode and create uncertainties and decisions. (which should be generated as footnotes)
- In reader mode, don't make extend the reading area all the way to the right (this cases the "edit, author, reader" menu to move
- i don't think you implemented the json that store uncertainty metadata?
- also your markdown should also support itemized and numbered lists 

## 5. Information request that ended up creating a JSON viewer

how is the user supposed to inspect the knowledge base?

## 6. Adding description text to the footnotes
this is fantastic. 

Here is an example I'm looking at:

```
This project[^unc-ydphqg] has huge potential.
I wonder if we should prioritize[^unc-hkira0] performance[^unc-demo1] or features.

- Item 1
- Item 2

[^unc-demo1]: <!-- druide:uncertainty:id=demo1 -->
[^unc-ydphqg]: <!-- druide:uncertainty:id=ydphqg -->
[^unc-hkira0]: <!-- druide:decision:id=hkira0 -->
```

And the json is:

```
{
  "demo1": {
    "id": "demo1",
    "type": "uncertainty",
    "description": "Unknown",
    "question": "",
    "text": "2",
    "range": {
      "start": 146,
      "end": 147
    }
  },
  "ydphqg": {
    "id": "ydphqg",
    "type": "uncertainty",
    "description": "what is this?",
    "text": "-->",
    "resolved": false,
    "question": "",
    "range": {
      "start": 196,
      "end": 199
    }
  },
  "hkira0": {
    "id": "hkira0",
    "type": "decision",
    "description": "or order?",
    "text": "-->",
    "resolved": false,
    "question": "or order?",
    "range": {
      "start": 249,
      "end": 252
    }
  }
}
```

I want the "description" field in the JSON, to appear as text in the footnote in markdown. So for example for the decision in the example the markdown should be:

```
[^unc-hkira0]: <!-- druide:decision:id=hkira0 druide:decision:description="
or order
?"-->
```
So the text of the description should appear unhindered from all the "techy" text

## 7. Keeping track of text chunks, updating annotations

ok a couple of things:
1) when I highlight a chunk of text to add an annotation, I want that whole chunk to be remembered as the anchor. but I also want the footnotes to remain clean. Not sure how to manage this tradeoff. Maybe the json should store the chunk and then the author view should know to highlight the text appropriately?

2) I want to be able to update (edit and save) the descriptions of the annotations

## 8. Debugging the Author view

The `[^unc-demo1]` markdown code should not appear in the Author view

## 9. Debugging rendering
When I try to make the items into a a decision (which makes sense, as a decision might be between choosing something from that list), the highlighting and the rendering break in a weird way. Here is a screenshot, that shows both the highlighting (only picked out Item1) and the rendering (item two appears twice, the second time with --> attached). And you also see the JSON which seems to have captured the correct text.

## 10. Debugging an error

When I try to annotate a list like that I get this error. It is fine outside of lists

## 11. Debugging the Reader view

this is fantastic! 

But the reader view now seems to be messed up

Here is the JSON:

```
{
  "demo1": {
    "id": "demo1",
    "resolved": false,
    "question": "",
    "text": "performance",
    "range": {
      "start": 66,
      "end": 77
    },
    "type": "uncertainty",
    "description": "Unknown"
  },
  "w73td6": {
    "id": "w73td6",
    "resolved": false,
    "question": "hello",
    "text": "Item 1\n- Item 2",
    "range": {
      "start": 106,
      "end": 121
    },
    "type": "decision",
    "description": "hello"
  }
}
```

