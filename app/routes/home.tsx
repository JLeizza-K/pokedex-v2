import { Form, redirect } from "react-router";
import * as v from "valibot";
import type { Route } from "./+types/home";

const PokemonResultsSchema = v.object({
  name: v.string(),
  url: v.string(),
});
const ResultsSchema = v.object({
  results: v.array(PokemonResultsSchema),
});

const PokemonSpritesSchema = v.object({
  front_default: v.string(),
});
const TypeNameSchema = v.object({
  name: v.string(),
});
const TypesSchema = v.object({
  type: TypeNameSchema,
});
const PokemonSchema = v.object({
  id: v.number(),
  name: v.string(),
  sprites: PokemonSpritesSchema,
  types: v.array(TypesSchema),
});

type Pokemon = v.InferOutput<typeof PokemonSchema>;
//  TODO: use correct structure of "intent" (ActionType in your case)
// in the video I show using an object
type ActionType = "capture" | "release";

export async function action({ request }: Route.LoaderArgs) {
  const formData = await request.formData();
  const pokemonIdString = v.parse(v.string(), formData.get("pokemonId"));
  const buttonAction = v.parse(v.string(), formData.get("action"));
  const url = new URL(request.url);

  // TODO: you should use "switch" instead of if/else if
  const params = url.searchParams.get("captured");
  // TODO: you should validate the result of a `JSON.parse` operation
  // as we did with `fetch` or `localStorage.getItem`
  const captured = new Set<number>(params ? JSON.parse(params) : []);
  if (buttonAction === "capture") {
    captured.add(Number(pokemonIdString));
  } else if (buttonAction === "release") {
    captured.delete(Number(pokemonIdString));
  }

  url.searchParams.set("captured", JSON.stringify(Array.from(captured)));

  return redirect(url.toString());
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params = url.searchParams.get("captured");
  // TODO: you should validate the result of a `JSON.parse` operation,
  // as we did with `fetch` or `localStorage.getItem`
  const capturedIds = new Set<number>(params ? JSON.parse(params) : []);

  const response = await fetch(
    "https://pokeapi.co/api/v2/pokemon?limit=20&offset=0",
  );

  const data = await response.json();
  const resultsList = v.parse(ResultsSchema, data);
  const pokemonURLs = resultsList.results.map((pokemon) => {
    return pokemon.url;
  });

  const pokemons = await Promise.all(
    pokemonURLs.map(async (url) => {
      const response = await fetch(url);
      const data = await response.json();
      const pokemon = v.parse(PokemonSchema, data);
      return pokemon;
    }),
  );

  // TODO: rename this variable
  // "captured" what? are these "ids", are these whole "pokemons"?
  // I can't know by a simple glance, and that's the whole point
  const captured = pokemons.filter((pokemon) => {
    return capturedIds.has(pokemon.id);
  });

  return { pokemons, captured };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { pokemons, captured } = loaderData;

  return (
    <>
      <h1 className="page-title">Pokedex</h1>
      <main className="main-container">
        {/* great usage of grid and componentization */}
        <PokemonGrid pokemons={pokemons} buttonLabel="+" actionType="capture" />
        <PokemonGrid pokemons={captured} buttonLabel="-" actionType="release" />
      </main>
    </>
  );
}

function PokemonGrid({
  pokemons,
  buttonLabel,
  actionType,
}: {
  pokemons: Pokemon[];
  buttonLabel: string;
  actionType: ActionType;
}) {
  return (
    <div className="pokemon-grid">
      {pokemons.map((pokemon, index) => {
        const pokeId = `Poke-${index}`;
        return (
          <div key={pokeId} className="card">
            <img src={pokemon.sprites.front_default} alt={pokemon.name} />
            <p>{pokemon.name}</p>
            <ul>
              {pokemon.types.map((type, index) => {
                const pokeTypeId = `PokeType-${index}`;
                return <li key={pokeTypeId}>{type.type.name}</li>;
              })}
            </ul>
            <Form method="POST">
              <input type="hidden" name="action" value={actionType} />
              <input type="hidden" name="pokemonId" value={pokemon.id} />
              <button type="submit">{buttonLabel}</button>
            </Form>
          </div>
        );
      })}
    </div>
  );
}
