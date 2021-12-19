import React, { useCallback, useState } from "react";
import { useInfiniteQuery } from "react-query";
import { InView } from "react-intersection-observer";

import useGA from "../../js/hooks/useGA";
import useGetIdFromQuery from "../../js/hooks/useGetIdFromQuery";
import useWindowWidth from "../../js/hooks/useWindowWidth";

import { getEntries } from "../../js/functions";
import { EMPTY_FILTERS_STATE } from "../../constants/filters";

import Header from "../timeline/Header";
import Filters from "../timeline/Filters";
import Entry from "../timeline/Entry";
import Loader from "../timeline/Loader";
import Error from "../shared/Error";
import Footer from "../shared/Footer";
import ScamTotal from "../timeline/ScamTotal";

export default function Timeline() {
  useGA();
  const windowWidth = useWindowWidth();
  const startAtId = useGetIdFromQuery();

  const [filters, setFilters] = useState(EMPTY_FILTERS_STATE);

  const getFilteredEntries = useCallback(
    ({ pageParam = null }) => {
      let cursor = null;
      let direction = "next";
      if (pageParam) {
        cursor = pageParam.cursor;
        direction = pageParam.direction;
      }
      return getEntries({ ...filters, startAtId, cursor, direction });
    },
    [filters, startAtId]
  );

  const {
    data,
    fetchPreviousPage,
    fetchNextPage,
    isFetching,
    isLoading,
    isError,
    hasNextPage,
    hasPreviousPage,
  } = useInfiniteQuery(["entries", filters], getFilteredEntries, {
    getPreviousPageParam: (lastPage, pages) => {
      if (!lastPage) {
        // This is the first fetch, so we have no cursor
        return null;
      }
      if (lastPage.hasMoreBefore === false) {
        // No entries remain, return undefined to signal this to react-query
        return undefined;
      }
      return { cursor: lastPage.entries[0]._key, direction: "prev" };
    },
    getNextPageParam: (lastPage, pages) => {
      if (!lastPage) {
        // This is the first fetch, so we have no cursor
        return null;
      }
      if (lastPage.hasMore === false) {
        // No entries remain, return undefined to signal this to react-query
        return undefined;
      }
      return {
        cursor: lastPage.entries[lastPage.entries.length - 1]._key,
        direction: "next",
      };
    },
  });

  const [currentRunningScamTotal, setCurrentRunningScamTotal] = useState(0);
  const [shouldScrollTo, setShouldScrollTo] = useState(startAtId);

  const renderScrollSentinel = (edge) => (
    <InView
      threshold={0}
      onChange={(inView) => {
        if (inView && !isFetching) {
          if (edge === "top") {
            setShouldScrollTo(data.pages[0].entries[0]._key);
            console.log(shouldScrollTo);
            fetchPreviousPage();
          } else {
            setShouldScrollTo(null);
            fetchNextPage();
          }
        }
      }}
      className="scroll-sentinel"
    />
  );

  const renderEntry = ({
    entry,
    entryInd,
    isFirstPage,
    isLastPage,
    isFirstEntry,
    isLastEntry,
    runningScamTotal,
  }) => {
    let className = entryInd % 2 === 0 ? "even" : "odd";
    if (isFirstEntry) {
      className += " first";
    }
    if (entry.scamTotal) {
      runningScamTotal += entry.scamTotal;
    }

    const entryElement = (
      <Entry
        key={entry.id}
        entry={entry}
        className={className}
        windowWidth={windowWidth}
        runningScamTotal={runningScamTotal}
        currentRunningScamTotal={currentRunningScamTotal}
        setCurrentRunningScamTotal={setCurrentRunningScamTotal}
        shouldScrollTo={shouldScrollTo}
      />
    );

    // Render the scroll sentinel above the last entry in the last page of results so we can begin loading
    // the next page when it comes into view.
    if ((isFirstPage && isFirstEntry) || (isLastPage && isLastEntry)) {
      return (
        <React.Fragment key={`${entry.id}-withSentinel`}>
          {renderScrollSentinel(isLastPage && isLastEntry ? "bottom" : "top")}
          {entryElement}
        </React.Fragment>
      );
    }
    return entryElement;
  };

  const renderEntries = () => {
    let runningScamTotal = 0;
    return (
      <article className="timeline">
        {hasPreviousPage && <Loader />}
        {data.pages.map((page, pageInd) => {
          const isFirstPage = pageInd === 0;
          const isLastPage = pageInd === data.pages.length - 1;
          return (
            <React.Fragment key={`page-${pageInd}`}>
              {page.entries.map((entry, entryInd) => {
                const isFirstEntry = isFirstPage && entryInd === 0;
                const isLastEntry = entryInd === page.entries.length - 1;
                return renderEntry({
                  entry,
                  entryInd,
                  isFirstPage,
                  isLastPage,
                  isFirstEntry,
                  isLastEntry,
                  runningScamTotal,
                });
              })}
            </React.Fragment>
          );
        })}
        {hasNextPage && <Loader />}
      </article>
    );
  };

  const renderBody = () => {
    if (isLoading) {
      return <Loader />;
    } else if (isError) {
      return <Error />;
    }
    return renderEntries();
  };

  return (
    <>
      <Header windowWidth={windowWidth} />
      <Filters filters={filters} setFilters={setFilters} />
      <div className="timeline-page content-wrapper" aria-busy={isLoading}>
        {renderBody()}
      </div>
      {!startAtId && <ScamTotal total={currentRunningScamTotal} />}
      <Footer />
    </>
  );
}
