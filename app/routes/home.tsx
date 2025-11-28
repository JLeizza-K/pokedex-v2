import { Form, redirect, useFetcher } from "react-router";
import * as v from "valibot";
import type { Route } from "./+types/home";

const INTENT = {
  CAPTURE: "capture",
  RELEASE: "release",
  FILTER: "filter",
};

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

const SetSchema = v.pipe(
  v.array(v.number()),
  v.transform((array) => {
    return new Set(array);
  }),
);
type Pokemon = v.InferOutput<typeof PokemonSchema>;

export async function action({ request }: Route.LoaderArgs) {
  const formData = await request.formData();
  const intent = v.parse(v.string(), formData.get("intent"));

  const url = new URL(request.url);

  const params = url.searchParams.get("captured");
  let captured: Set<number>;
  if (params) {
    const data = JSON.parse(params);
    captured = v.parse(SetSchema, data);
  } else {
    captured = new Set<number>();
  }

  switch (intent) {
    case INTENT.CAPTURE: {
      const pokemonId = v.parse(v.string(), formData.get("pokemonId"));
      captured.add(Number(pokemonId));
      break;
    }
    case INTENT.RELEASE: {
      const pokemonId = v.parse(v.string(), formData.get("pokemonId"));
      captured.delete(Number(pokemonId));
      break;
    }
    case INTENT.FILTER: {
      const filterName = v.parse(v.string(), formData.get("filterName"));
      const filterType = v.parse(v.string(), formData.get("filterType"));
      if (filterName) {
        url.searchParams.set("filterName", filterName);
      } else {
        url.searchParams.delete("filterName");
      }
      if (filterType) {
        url.searchParams.set("filterType", filterType);
      } else {
        url.searchParams.delete("filterType");
      }
      break;
    }
  }

  url.searchParams.set("captured", JSON.stringify(Array.from(captured)));

  return redirect(url.toString());
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params = url.searchParams.get("captured");
  const capturedIds = new Set<number>(params ? JSON.parse(params) : []);
  // this `??` is specifically to assign default values to null or undefined
  const filterName = url.searchParams.get("filterName") ?? "";
  const filterType = url.searchParams.get("filterType") ?? "";

  const response = await fetch(
    "https://pokeapi.co/api/v2/pokemon?limit=24&offset=0",
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
  const displayedPokemons = pokemons
    .filter((pokemon) => {
      if (!filterName) {
        return true;
      }

      return pokemon.name.toLowerCase().includes(filterName.toLowerCase());
    })
    .filter((pokemon) => {
      if (!filterType) {
        return true;
      }
      return pokemon.types.some((type) => {
        return type.type.name === filterType;
      });
    });

  const capturedPokemons = pokemons.filter((pokemon) => {
    return capturedIds.has(pokemon.id);
  });

  return { pokemons, capturedPokemons, displayedPokemons };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { capturedPokemons, pokemons, displayedPokemons } = loaderData;
  const fetcher = useFetcher();
  return (
    <>
      <p className="page-title">Pokedex</p>
      <fetcher.Form
        onChange={(event) => {
          fetcher.submit(event.currentTarget, { method: "POST" });
        }}
      >
        <input className="filter" type="search" name="filterName" />
        <select className="filter" name="filterType">
          <option value="">All types</option>
          {Array.from(
            new Set(
              pokemons.flatMap((pokemon) =>
                pokemon.types.map((t) => t.type.name),
              ),
            ),
          ).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <input type="hidden" name="intent" value={INTENT.FILTER} />
      </fetcher.Form>
      <main className="main-container">
        <PokemonGrid
          pokemons={displayedPokemons}
          buttonLabel="+"
          actionType={INTENT.CAPTURE}
        />
        <PokemonGrid
          pokemons={capturedPokemons}
          buttonLabel="-"
          actionType={INTENT.RELEASE}
        />
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
  actionType: string;
}) {
  return (
    <div className="pokemon-grid">
      {pokemons.map((pokemon, index) => {
        const id = `Poke-${index}`;
        return (
          <div key={id} className="card">
            <img src={pokemon.sprites.front_default} alt={pokemon.name} />
            <p>{pokemon.name}</p>
            <ul>
              {pokemon.types.map((type, index) => {
                const id = `PokeType-${index}`;
                return <li key={id}>{type.type.name}</li>;
              })}
            </ul>
            <Form method="POST">
              <input type="hidden" name="intent" value={actionType} />
              <input type="hidden" name="pokemonId" value={pokemon.id} />
              <button type="submit">{buttonLabel}</button>
            </Form>
          </div>
        );
      })}
    </div>
  );
}
