/**
 * Definition builders for WebIDL and TypeScript.
 * @module definitions
 *//***/

import {
  Program,
  Element,
  CommonFlags,
  ElementKind,
  Global,
  Enum,
  EnumValue,
  Function,
  Class,
  Namespace,
  FunctionPrototype,
  ClassPrototype,
  ConstantValueKind,
  Interface
} from "./program";

import {
  Type,
  TypeKind
} from "./types";

import {
  indent
} from "./util";

/** Walker base class. */
abstract class ExportsWalker {

  /** Program reference. */
  program: Program;

  /** Constructs a new Element walker. */
  constructor(program: Program) {
    this.program = program;
  }

  walk(): void {
    for (let element of this.program.moduleLevelExports.values()) {
      this.visitElement(element);
    }
  }

  visitElement(element: Element): void {
    switch (element.kind) {
      case ElementKind.GLOBAL: {
        if (element.is(CommonFlags.COMPILED)) {
          this.visitGlobal(<Global>element);
        }
        break;
      }
      case ElementKind.ENUM: {
        if (element.is(CommonFlags.COMPILED)) {
          this.visitEnum(<Enum>element);
        }
        break;
      }
      case ElementKind.FUNCTION_PROTOTYPE: {
        for (let instance of (<FunctionPrototype>element).instances.values()) {
          if (instance.is(CommonFlags.COMPILED)) {
            this.visitFunction(<Function>instance);
          }
        }
        break;
      }
      case ElementKind.CLASS_PROTOTYPE: {
        for (let instance of (<ClassPrototype>element).instances.values()) {
          if (instance.is(CommonFlags.COMPILED)) {
            this.visitClass(<Class>instance);
          }
        }
        break;
      }
      case ElementKind.NAMESPACE: {
        if ((<Namespace>element).is(CommonFlags.COMPILED)) {
          this.visitNamespace(<Namespace>element);
        }
        break;
      }
      default: {
        assert(false);
        break;
      }
    }
  }

  abstract visitGlobal(element: Global): void;
  abstract visitEnum(element: Enum): void;
  abstract visitFunction(element: Function): void;
  abstract visitClass(element: Class): void;
  abstract visitInterface(element: Interface): void;
  abstract visitNamespace(element: Element): void;
}

/** A WebIDL definitions builder. */
export class IDLBuilder extends ExportsWalker {

  /** Builds WebIDL definitions for the specified program. */
  static build(program: Program): string {
    return new IDLBuilder(program).build();
  }

  private sb: string[] = [];
  private seen: Set<Element> = new Set();
  private indentLevel: i32 = 0;

  /** Constructs a new WebIDL builder. */
  constructor(program: Program) {
    super(program);
  }

  visitGlobal(element: Global): void {
    if (this.seen.has(element)) return;
    this.seen.add(element);
    var sb = this.sb;
    var isConst = element.is(CommonFlags.INLINED);
    indent(sb, this.indentLevel);
    if (isConst) {
      sb.push("const ");
    }
    sb.push(this.typeToString(element.type));
    sb.push(" ");
    sb.push(element.simpleName);
    if (isConst) {
      switch (element.constantValueKind) {
        case ConstantValueKind.INTEGER: {
          sb.push(" = ");
          sb.push(i64_to_string(element.constantIntegerValue));
          break;
        }
        case ConstantValueKind.FLOAT: {
          sb.push(" = ");
          sb.push(element.constantFloatValue.toString());
          break;
        }
        default: assert(false);
      }
    }
    sb.push(";\n");
  }

  visitEnum(element: Enum): void {
    if (this.seen.has(element)) return;
    this.seen.add(element);
    var sb = this.sb;
    indent(sb, this.indentLevel++);
    sb.push("interface ");
    sb.push(element.simpleName);
    sb.push(" {\n");
    var members = element.members;
    if (members) {
      for (let [name, member] of members) {
        if (member.kind == ElementKind.ENUMVALUE) {
          let isConst = (<EnumValue>member).is(CommonFlags.INLINED);
          indent(sb, this.indentLevel);
          if (isConst) {
            sb.push("const ");
          } else {
            sb.push("readonly ");
          }
          sb.push("unsigned long ");
          sb.push(name);
          if (isConst) {
            sb.push(" = ");
            sb.push((<EnumValue>member).constantValue.toString(10));
          }
          sb.push(";\n");
        }
      }
      for (let member of members.values()) {
        if (member.kind != ElementKind.ENUMVALUE) {
          this.visitElement(member);
        }
      }
    }
    indent(sb, --this.indentLevel);
    sb.push("}\n");
  }

  visitFunction(element: Function): void {
    if (this.seen.has(element)) return;
    this.seen.add(element);
    var sb = this.sb;
    var signature = element.signature;
    indent(sb, this.indentLevel);
    sb.push(this.typeToString(signature.returnType));
    sb.push(" ");
    sb.push(element.simpleName);
    sb.push("(");
    var parameters = signature.parameterTypes;
    var numParameters = parameters.length;
    // var requiredParameters = signature.requiredParameters;
    for (let i = 0; i < numParameters; ++i) {
      if (i) sb.push(", ");
      // if (i >= requiredParameters) sb.push("optional ");
      sb.push(this.typeToString(parameters[i]));
      sb.push(" ");
      sb.push(signature.getParameterName(i));
    }
    sb.push(");\n");
    var members = element.members;
    if (members && members.size) {
      indent(sb, this.indentLevel);
      sb.push("interface ");
      sb.push(element.simpleName);
      sb.push(" {\n");
      for (let member of members.values()) {
        this.visitElement(member);
      }
      indent(sb, --this.indentLevel);
      sb.push("}\n");
    }
  }

  visitClass(element: Class): void {
    if (this.seen.has(element)) return;
    this.seen.add(element);
    var sb = this.sb;
    indent(sb, this.indentLevel++);
    sb.push("interface ");
    sb.push(element.simpleName);
    sb.push(" {\n");
    // TODO
    indent(sb, --this.indentLevel);
    sb.push("}\n");
  }

  visitInterface(element: Interface): void {
    this.visitClass(element);
  }

  visitNamespace(element: Namespace): void {
    if (this.seen.has(element)) return;
    this.seen.add(element);
    var sb = this.sb;
    indent(sb, this.indentLevel++);
    sb.push("interface ");
    sb.push(element.simpleName);
    sb.push(" {\n");
    var members = element.members;
    if (members) {
      for (let member of members.values()) {
        this.visitElement(member);
      }
    }
    indent(sb, --this.indentLevel);
    sb.push("}\n");
  }

  typeToString(type: Type): string {
    switch (type.kind) {
      case TypeKind.I8: return "byte";
      case TypeKind.I16: return "short";
      case TypeKind.I32: return "long";
      case TypeKind.I64: return "long long";
      case TypeKind.ISIZE: return this.program.options.isWasm64 ? "long long" : "long";
      case TypeKind.U8: return "octet";
      case TypeKind.U16: return "unsigned short";
      case TypeKind.U32: return "unsigned long";
        // ^ TODO: function types
      case TypeKind.U64: return "unsigned long long";
      case TypeKind.USIZE: return this.program.options.isWasm64 ? "unsigned long long" : "unsigned long";
        // ^ TODO: class types
      case TypeKind.BOOL: return "boolean";
      case TypeKind.F32: return "unrestricted float";
      case TypeKind.F64: return "unrestricted double";
      case TypeKind.VOID: return "void";
      default: {
        assert(false);
        return "";
      }
    }
  }

  build(): string {
    var sb = this.sb;
    sb.push("interface ASModule {\n");
    ++this.indentLevel;
    this.walk();
    --this.indentLevel;
    sb.push("}\n");
    return sb.join("");
  }
}

/** A TypeScript definitions builder. */
export class TSDBuilder extends ExportsWalker {

  /** Builds TypeScript definitions for the specified program. */
  static build(program: Program): string {
    return new TSDBuilder(program).build();
  }

  private sb: string[] = [];
  private seen: Set<Element> = new Set();
  private indentLevel: i32 = 0;

  /** Constructs a new WebIDL builder. */
  constructor(program: Program) {
    super(program);
  }

  visitGlobal(element: Global): void {
    if (this.seen.has(element)) return;
    this.seen.add(element);
    var sb = this.sb;
    var isConst = element.is(CommonFlags.INLINED);
    indent(sb, this.indentLevel);
    if (isConst) {
      sb.push("const ");
    }
    sb.push(element.simpleName);
    sb.push(": ");
    sb.push(this.typeToString(element.type));
    sb.push(";\n");
    this.visitNamespace(element);
  }

  visitEnum(element: Enum): void {
    if (this.seen.has(element)) return;
    this.seen.add(element);
    var sb = this.sb;
    indent(sb, this.indentLevel++);
    sb.push("enum ");
    sb.push(element.simpleName);
    sb.push(" {\n");
    var members = element.members;
    if (members) {
      let numMembers = members.size;
      for (let [name, member] of members) {
        if (member.kind == ElementKind.ENUMVALUE) {
          this.seen.add(member);
          indent(sb, this.indentLevel);
          sb.push(name);
          if (member.is(CommonFlags.INLINED)) {
            sb.push(" = ");
            sb.push((<EnumValue>member).constantValue.toString(10));
          }
          sb.push(",\n");
          --numMembers;
        }
      }
      if (numMembers) {
        this.visitNamespace(element);
      }
    }
    indent(sb, --this.indentLevel);
    sb.push("}\n");
  }

  visitFunction(element: Function): void {
    if (this.seen.has(element)) return;
    this.seen.add(element);
    var sb = this.sb;
    var signature = element.signature;
    indent(sb, this.indentLevel);
    sb.push("function ");
    sb.push(element.simpleName);
    sb.push("(");
    var parameters = signature.parameterTypes;
    var numParameters = parameters.length;
    // var requiredParameters = signature.requiredParameters;
    for (let i = 0; i < numParameters; ++i) {
      if (i) sb.push(", ");
      // if (i >= requiredParameters) sb.push("optional ");
      sb.push(signature.getParameterName(i));
      sb.push(": ");
      sb.push(this.typeToString(parameters[i]));
    }
    sb.push("): ");
    sb.push(this.typeToString(signature.returnType));
    sb.push(";\n");
    this.visitNamespace(element);
  }

  visitClass(element: Class): void {
    if (this.seen.has(element)) return;
    this.seen.add(element);
    var sb = this.sb;
    var isInterface = element.kind == ElementKind.INTERFACE;
    indent(sb, this.indentLevel++);
    if (isInterface) {
      sb.push("interface ");
    } else {
      if (element.is(CommonFlags.ABSTRACT)) {
        sb.push("abstract ");
      }
      sb.push("class ");
    }
    sb.push(element.simpleName);
    var base = element.base;
    if (base) {
      sb.push(" extends ");
      sb.push(base.simpleName); // TODO: fqn
    }
    sb.push(" {\n");
    var members = element.prototype.members; // static
    if (members) {
      // TODO
    }
    members = element.members; // instance
    if (members) {
      // TODO
    }
    indent(sb, --this.indentLevel);
    sb.push("}\n");
  }

  visitInterface(element: Interface): void {
    this.visitClass(element);
  }

  visitNamespace(element: Element): void {
    var members = element.members;
    if (members && members.size) {
      let sb = this.sb;
      indent(sb, this.indentLevel++);
      sb.push("namespace ");
      sb.push(element.simpleName);
      sb.push(" {\n");
      for (let member of members.values()) {
        this.visitElement(member);
      }
      indent(sb, --this.indentLevel);
      sb.push("}\n");
    }
  }

  typeToString(type: Type): string {
    switch (type.kind) {
      case TypeKind.I8: return "i8";
      case TypeKind.I16: return "i16";
      case TypeKind.I32: return "i32";
      case TypeKind.I64: return "I64";
      case TypeKind.ISIZE: return this.program.options.isWasm64 ? "I64" : "i32";
      case TypeKind.U8: return "u8";
      case TypeKind.U16: return "u16";
      case TypeKind.U32: return "u32";
        // ^ TODO: function types
      case TypeKind.U64: return "U64";
      case TypeKind.USIZE: return this.program.options.isWasm64 ? "U64" : "u32";
        // ^ TODO: class types
      case TypeKind.BOOL: return "bool";
      case TypeKind.F32: return "f32";
      case TypeKind.F64: return "f64";
      case TypeKind.VOID: return "void";
      default: {
        assert(false);
        return "";
      }
    }
  }

  build(): string {
    var sb = this.sb;
    sb.push("declare module ASModule {\n");
    sb.push("  type i8 = number;\n");
    sb.push("  type i16 = number;\n");
    sb.push("  type i32 = number;\n");
    sb.push("  type u8 = number;\n");
    sb.push("  type u16 = number;\n");
    sb.push("  type u32 = number;\n");
    sb.push("  type f32 = number;\n");
    sb.push("  type f64 = number;\n");
    sb.push("  type bool = any;\n");
    ++this.indentLevel;
    this.walk();
    --this.indentLevel;
    sb.push("}\n");
    return this.sb.join("");
  }
}

// TODO: C bindings? or is this sufficiently covered by WebIDL and using a 3rd-party tool?
