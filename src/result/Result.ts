import Option from '../option/Option';

enum ResultType {
  Ok,
  Err
}

type ResultInit<T, E> = { type: ResultType.Err; error: E } | { type: ResultType.Ok; value: T };
type ResultInternal<T, E> = ResultInit<T, E>;
type ResultValueGetter<T, E> = (error: E) => T;
type ResultErrorGetter<E, U> = (error: E) => U;
type ResultValueMapper<T, U> = (value: T) => U;
type ResultErrorMapper<E, F> = (error: E) => F;
type ResultValueConverter<T, U, E> = (value: T) => Result<U, E>;
type ResultErrorConverter<E, T, F> = (error: E) => Result<T, F>;

/*
 * Spec: https://doc.rust-lang.org/std/result/
 *
 * Omitted categories of methods:
 *   - Adapters for working with references
 *   - Comparison operators
 *   - Iterating over `Result` (reference related variants)
 *   - Collecting into `Result`
 */
export default class Result<T, E> {
  static Ok<TValue, TError = unknown>(value: TValue): Result<TValue, TError> {
    const init: ResultInit<TValue, TError> = { type: ResultType.Ok, value };

    return new Result<TValue, TError>(init);
  }

  static Err<TError, TValue = unknown>(error: TError): Result<TValue, TError> {
    const init: ResultInit<TValue, TError> = { type: ResultType.Err, error };

    return new Result<TValue, TError>(init);
  }

  private internal: ResultInternal<T, E>;

  private constructor(init: ResultInit<T, E>) {
    this.internal = { ...init };
  }

  /*
   * Querying the variant
   */
  isOk(): boolean {
    return this.internal.type === ResultType.Ok;
  }

  isErr(): boolean {
    return this.internal.type === ResultType.Err;
  }

  /*
   * Extracting the contained value
   */
  expect(message: string): T {
    if (this.internal.type === ResultType.Err) {
      throw new Error(`${message}: ${this.internal.error}`);
    }

    return this.internal.value;
  }

  unwrap(): T {
    if (this.internal.type === ResultType.Err) {
      throw new Error(`${this.internal.error}`);
    }

    return this.internal.value;
  }

  unwrapOr(defaultValue: T): T {
    return this.internal.type === ResultType.Err ? defaultValue : this.internal.value;
  }

  unwrapOrElse(defaultValueFunc: ResultValueGetter<T, E>): T {
    return this.internal.type === ResultType.Err
      ? defaultValueFunc(this.internal.error)
      : this.internal.value;
  }

  unwrapOrDefault(): T {
    throw new Error('Not implemented: use either `unwrapOr` or `unwrapOrElse` instead.');
  }

  expectErr(message: string): E {
    if (this.internal.type === ResultType.Ok) {
      throw new Error(`${message}: ${this.internal.value}`);
    }

    return this.internal.error;
  }

  unwrapErr(): E {
    if (this.internal.type === ResultType.Ok) {
      throw new Error(`${this.internal.value}`);
    }

    return this.internal.error;
  }

  /*
   * Transforming contained values
   */
  err(): Option<E> {
    if (this.internal.type === ResultType.Err) {
      return Option.Some<E>(this.internal.error);
    }

    return Option.None<E>();
  }

  ok(): Option<T> {
    if (this.internal.type === ResultType.Err) {
      return Option.None<T>();
    }

    return Option.Some<T>(this.internal.value);
  }

  transpose(): Option<Result<T, E>> {
    if (this.internal.type === ResultType.Err) {
      const init: ResultInit<T, E> = { type: ResultType.Err, error: this.internal.error };
      return Option.Some<Result<T, E>>(new Result<T, E>(init));
    }

    if (this.internal.type === ResultType.Ok) {
      const { value } = this.internal;
      if (value instanceof Option) {
        return value.isNone()
          ? Option.None<Result<T, E>>()
          : Option.Some<Result<T, E>>(value.unwrap());
      }
    }

    throw new Error('Called `transpose` on a invalid `Ok` value.');
  }

  map<U>(valueMapperFunc: ResultValueMapper<T, U>): Result<U, E> {
    const init: ResultInit<U, E> =
      this.internal.type === ResultType.Err
        ? { ...this.internal }
        : {
            type: ResultType.Ok,
            value: valueMapperFunc(this.internal.value)
          };

    return new Result<U, E>(init);
  }

  mapErr<F>(errorMapperFunc: ResultErrorMapper<E, F>): Result<T, F> {
    const init: ResultInit<T, F> =
      this.internal.type === ResultType.Ok
        ? { ...this.internal }
        : { type: ResultType.Err, error: errorMapperFunc(this.internal.error) };

    return new Result<T, F>(init);
  }

  mapOr<U>(defaultValue: U, valueMapperFunc: ResultValueMapper<T, U>): U {
    if (this.internal.type === ResultType.Err) {
      return defaultValue;
    }

    return valueMapperFunc(this.internal.value);
  }

  mapOrElse<U>(
    defaultValueFunc: ResultErrorGetter<E, U>,
    valueMapperFunc: ResultValueMapper<T, U>
  ): U {
    if (this.internal.type === ResultType.Err) {
      return defaultValueFunc(this.internal.error);
    }

    return valueMapperFunc(this.internal.value);
  }

  /**
   * Boolean operators
   */
  and<U>(other: Result<U, E>): Result<U, E> {
    if (this.internal.type === ResultType.Err) {
      // This is safe since the type `T` and `U` doesn't matter here
      return this as unknown as Result<U, E>;
    }

    return other;
  }

  or<F>(other: Result<T, F>): Result<T, F> {
    if (this.internal.type === ResultType.Ok) {
      // This is safe since the type `E` and `F` doesn't matter here
      return this as unknown as Result<T, F>;
    }

    return other;
  }

  andThen<U>(valueConverterFunc: ResultValueConverter<T, U, E>): Result<U, E> {
    if (this.internal.type === ResultType.Err) {
      // This is safe since the type `T` and `U` doesn't matter here
      return this as unknown as Result<U, E>;
    }

    return valueConverterFunc(this.internal.value);
  }

  orElse<F>(errorConverterFunc: ResultErrorConverter<E, T, F>): Result<T, F> {
    if (this.internal.type === ResultType.Ok) {
      // This is safe since the type `E` and `F` doesn't matter here
      return this as unknown as Result<T, F>;
    }

    return errorConverterFunc(this.internal.error);
  }

  /*
   * Iterating over `Result`
   */
  *intoIter(): Generator<T> {
    if (this.internal.type === ResultType.Err) {
      return;
    }

    yield this.internal.value;
  }
}
